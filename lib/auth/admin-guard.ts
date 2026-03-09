import "server-only";

import { ConvexHttpClient } from "convex/browser";

import { api } from "@/convex/_generated/api";
import { Doc } from "@/convex/_generated/dataModel";

export type AdminGuardFailureCode =
  | "UNAUTHENTICATED"
  | "CONVEX_URL_MISSING"
  | "USER_NOT_FOUND"
  | "FORBIDDEN"
  | "ROLE_CHECK_FAILED";

export type AdminGuardSuccess = {
  ok: true;
  user: Doc<"users">;
};

export type AdminGuardFailure = {
  ok: false;
  code: AdminGuardFailureCode;
  message: string;
};

export type AdminGuardResult = AdminGuardSuccess | AdminGuardFailure;

function getConvexUrl(): string | null {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  return convexUrl && convexUrl.length > 0 ? convexUrl : null;
}

export async function getAuthenticatedConvexUser(
  convexToken: string | null | undefined
): Promise<Doc<"users"> | null> {
  if (!convexToken) {
    return null;
  }

  const convexUrl = getConvexUrl();
  if (!convexUrl) {
    return null;
  }

  const convex = new ConvexHttpClient(convexUrl);
  convex.setAuth(convexToken);

  return convex.query(api.users.getCurrentUser, {});
}

export async function verifyAdminAccess(
  convexToken: string | null | undefined
): Promise<AdminGuardResult> {
  if (!convexToken) {
    return {
      ok: false,
      code: "UNAUTHENTICATED",
      message: "Authentication is required.",
    };
  }

  const convexUrl = getConvexUrl();
  if (!convexUrl) {
    return {
      ok: false,
      code: "CONVEX_URL_MISSING",
      message: "Convex URL is not configured.",
    };
  }

  try {
    const convex = new ConvexHttpClient(convexUrl);
    convex.setAuth(convexToken);
    const user = await convex.query(api.users.getCurrentUser, {});

    if (!user) {
      return {
        ok: false,
        code: "USER_NOT_FOUND",
        message: "Authenticated user was not found.",
      };
    }

    if (user.role !== "admin") {
      return {
        ok: false,
        code: "FORBIDDEN",
        message: "Administrator access is required.",
      };
    }

    return {
      ok: true,
      user,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to verify administrator access.";

    return {
      ok: false,
      code: "ROLE_CHECK_FAILED",
      message,
    };
  }
}