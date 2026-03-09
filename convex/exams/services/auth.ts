import { Doc } from "../../_generated/dataModel";
import { MutationCtx } from "../../_generated/server";
import {
  AuthenticatedCtx as SharedAuthenticatedCtx,
  getAuthenticatedUser as getAuthenticatedUserFromCtx,
  requireAdminUser,
} from "../../lib/auth";

export type AuthenticatedCtx = SharedAuthenticatedCtx;

export async function getAuthenticatedUser(
  ctx: AuthenticatedCtx
): Promise<Doc<"users"> | null> {
  return getAuthenticatedUserFromCtx(ctx);
}

export async function assertAdminUser(
  ctx: MutationCtx
): Promise<Doc<"users">> {
  return requireAdminUser(ctx);
}

export async function getOwnedAttempt(
  ctx: AuthenticatedCtx,
  userId: Doc<"users">["_id"],
  examAttemptId: Doc<"examAttempts">["_id"]
): Promise<Doc<"examAttempts"> | null> {
  const attempt = await ctx.db.get(examAttemptId);
  if (!attempt || attempt.userId !== userId) {
    return null;
  }
  return attempt;
}

export function canAccessResultRecord(
  user: Doc<"users">,
  result: Doc<"examResults">
): boolean {
  if (user.role === "admin") {
    return true;
  }
  return result.userId === user._id;
}
