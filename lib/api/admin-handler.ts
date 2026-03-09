import "server-only";

import { auth } from "@clerk/nextjs/server";

import { Doc } from "@/convex/_generated/dataModel";
import { logAdminAccessAttempt } from "@/lib/audit/admin-access";
import { verifyAdminAccess } from "@/lib/auth/admin-guard";

export interface AdminApiErrorBody {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

export function adminApiErrorResponse(
  status: number,
  code: string,
  message: string
): Response {
  const body: AdminApiErrorBody = {
    success: false,
    error: {
      code,
      message,
    },
  };

  return Response.json(body, { status });
}

export interface AdminApiHandlerContext<TParams = Record<string, string | string[]>> {
  adminUser: Doc<"users">;
  clerkUserId: string;
  convexToken: string;
  params: TParams;
}

export type AdminApiHandler<TParams = Record<string, string | string[]>> = (
  req: Request,
  context: AdminApiHandlerContext<TParams>
) => Promise<Response>;

export function withAdminApiGuard<TParams = Record<string, string | string[]>>(
  handler: AdminApiHandler<TParams>
) {
  return async (
    req: Request,
    routeContext: { params: Promise<TParams> } | { params: TParams } = {
      params: {} as TParams,
    }
  ): Promise<Response> => {
    const { userId, getToken } = await auth();
    if (!userId) {
      await logAdminAccessAttempt({
        actorRole: "unknown",
        surface: "api",
        target: new URL(req.url).pathname,
        method: req.method,
        outcome: "denied",
        reason: "Authentication is required.",
      });

      return adminApiErrorResponse(
        401,
        "UNAUTHORIZED",
        "Authentication is required."
      );
    }

    const convexToken = await getToken({ template: "convex" });
    const adminCheck = await verifyAdminAccess(convexToken);

    if (!adminCheck.ok) {
      await logAdminAccessAttempt({
        actorUserId: adminCheck.user?._id,
        actorClerkId: userId,
        actorRole: adminCheck.user?.role ?? "unknown",
        surface: "api",
        target: new URL(req.url).pathname,
        method: req.method,
        outcome: "denied",
        reason: adminCheck.message,
        convexToken,
      });

      const status = adminCheck.code === "UNAUTHENTICATED" ? 401 : 403;
      const code = status === 401 ? "UNAUTHORIZED" : "FORBIDDEN";
      return adminApiErrorResponse(status, code, adminCheck.message);
    }

    if (!convexToken) {
      await logAdminAccessAttempt({
        actorUserId: adminCheck.user._id,
        actorClerkId: userId,
        actorRole: adminCheck.user.role,
        surface: "api",
        target: new URL(req.url).pathname,
        method: req.method,
        outcome: "denied",
        reason: "Could not obtain an authenticated Convex token.",
      });

      return adminApiErrorResponse(
        401,
        "UNAUTHORIZED",
        "Could not obtain an authenticated Convex token."
      );
    }

    const params =
      routeContext.params instanceof Promise
        ? await routeContext.params
        : routeContext.params;

    await logAdminAccessAttempt({
      actorUserId: adminCheck.user._id,
      actorClerkId: userId,
      actorRole: adminCheck.user.role,
      surface: "api",
      target: new URL(req.url).pathname,
      method: req.method,
      outcome: "allowed",
      reason: "Administrator role verified.",
      convexToken,
    });

    return handler(req, {
      adminUser: adminCheck.user,
      clerkUserId: userId,
      convexToken,
      params,
    });
  };
}