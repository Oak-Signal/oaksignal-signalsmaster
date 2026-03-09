import { Doc } from "../_generated/dataModel";
import { MutationCtx, QueryCtx } from "../_generated/server";

export type AuthenticatedCtx = QueryCtx | MutationCtx;

export async function getAuthenticatedUser(
  ctx: AuthenticatedCtx
): Promise<Doc<"users"> | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return null;
  }

  return ctx.db
    .query("users")
    .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
    .unique();
}

export async function requireAuthenticatedUser(
  ctx: AuthenticatedCtx,
  message = "Authentication is required."
): Promise<Doc<"users">> {
  const user = await getAuthenticatedUser(ctx);
  if (!user) {
    throw new Error(message);
  }

  return user;
}

export async function requireAdminUser(
  ctx: AuthenticatedCtx,
  message = "Only administrators can change official exam settings."
): Promise<Doc<"users">> {
  const user = await requireAuthenticatedUser(ctx);
  if (user.role !== "admin") {
    throw new Error(message);
  }

  return user;
}