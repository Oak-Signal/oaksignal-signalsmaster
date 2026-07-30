import { clerkClient, clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server"; // Need this for redirects
import { verifyAdminAccess } from "@/lib/auth/admin-guard";
import { logAdminAccessAttempt } from "@/lib/audit/admin-access";
// strict domain access
const ALLOWED_EMAIL_DOMAIN = process.env.ALLOWED_SIGNIN_EMAIL_DOMAIN?.trim().toLowerCase();

const isPublicRoute = createRouteMatcher([
  "/",
  "/login(.*)",
  "/sign-up(.*)",
  "/logout",
  "/faq(.*)", 
  "/legal(.*)",
  "/updates(.*)",
  "/forbidden",
  "/api/webhooks(.*)",
]);

// Define routes that logged-in users shouldn't visit
const isAuthRoute = createRouteMatcher([
  "/login(.*)",
  "/sign-up(.*)",
]);

const isAdminPageRoute = createRouteMatcher(["/admin(.*)"]);
const isAdminApiRoute = createRouteMatcher(["/api/admin(.*)"]);

function extractEmailFromSessionClaims(sessionClaims: unknown): string | null {
  if (!sessionClaims || typeof sessionClaims !== "object") {
    return null;
  }

  const claims = sessionClaims as Record<string, unknown>;
  const candidates = [
    claims.email,
    claims.email_address,
    claims.primary_email_address,
    claims.preferred_username,
    claims.upn,
    claims.unique_name,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.includes("@")) {
      return candidate.toLowerCase();
    }
  }

  return null;
}

async function resolveUserEmail(userId: string, sessionClaims: unknown): Promise<string | null> {
  const claimEmail = extractEmailFromSessionClaims(sessionClaims);
  if (claimEmail) {
    return claimEmail;
  }

  try {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const primaryEmailId = user.primaryEmailAddressId;
    const primaryEmail = user.emailAddresses.find((email) => email.id === primaryEmailId);
    const fallbackEmail = primaryEmail?.emailAddress ?? user.emailAddresses[0]?.emailAddress;
    return fallbackEmail ? fallbackEmail.toLowerCase() : null;
  } catch {
    return null;
  }
}

function jsonAccessError(status: number, code: string, message: string): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: {
        code,
        message,
      },
    },
    { status }
  );
}

export default clerkMiddleware(async (auth, request) => {
  const authData = await auth();
  const { userId, getToken } = authData;
  const sessionClaims = (authData as { sessionClaims?: unknown }).sessionClaims;
  let isAllowedDomainUser = true;

  if (userId && ALLOWED_EMAIL_DOMAIN) {
    const email = await resolveUserEmail(userId, sessionClaims);
    const domainSuffix = `@${ALLOWED_EMAIL_DOMAIN}`;
    isAllowedDomainUser = !!email && email.endsWith(domainSuffix);
    const isForbiddenRoute = request.nextUrl.pathname === "/forbidden";
    const isApiRoute = request.nextUrl.pathname.startsWith("/api/");
    const isPublic = isPublicRoute(request);

    if (!isAllowedDomainUser && !isForbiddenRoute && !isPublic) {
      if (isApiRoute) {
        return jsonAccessError(
          403,
          "FORBIDDEN_DOMAIN",
          "Your domain is not accepted."
        );
      }

      return NextResponse.redirect(new URL("/forbidden?reason=domain", request.url));
    }
  }

  // 1. If user is logged in and trying to access login/signup, redirect to dashboard
  if (userId && isAllowedDomainUser && isAuthRoute(request)) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  const isAdminPage = isAdminPageRoute(request);
  const isAdminApi = isAdminApiRoute(request);

  if (isAdminPage || isAdminApi) {
    if (!userId) {
      await logAdminAccessAttempt({
        actorRole: "unknown",
        surface: isAdminApi ? "api" : "page",
        target: request.nextUrl.pathname,
        method: request.method,
        outcome: "denied",
        reason: "Authentication is required.",
      });

      if (isAdminApi) {
        return jsonAccessError(401, "UNAUTHORIZED", "Authentication is required.");
      }

      await auth.protect();
      return;
    }

    const convexToken = await getToken({ template: "convex" });
    const adminCheck = await verifyAdminAccess(convexToken);

    if (!adminCheck.ok) {
      await logAdminAccessAttempt({
        actorUserId: adminCheck.user?._id,
        actorClerkId: userId,
        actorRole: adminCheck.user?.role ?? "unknown",
        surface: isAdminApi ? "api" : "page",
        target: request.nextUrl.pathname,
        method: request.method,
        outcome: "denied",
        reason: adminCheck.message,
        convexToken,
      });

      if (isAdminApi) {
        const status = adminCheck.code === "UNAUTHENTICATED" ? 401 : 403;
        const code = status === 401 ? "UNAUTHORIZED" : "FORBIDDEN";
        return jsonAccessError(status, code, adminCheck.message);
      }

      return NextResponse.redirect(new URL("/forbidden", request.url));
    }

    if (isAdminPage) {
      await logAdminAccessAttempt({
        actorUserId: adminCheck.user._id,
        actorClerkId: userId,
        actorRole: adminCheck.user.role,
        surface: "page",
        target: request.nextUrl.pathname,
        method: request.method,
        outcome: "allowed",
        reason: "Administrator role verified.",
        convexToken,
      });
    }

    return;
  }

  // 2. Protect private routes (like dashboard)
  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};