import { Doc } from "../../_generated/dataModel";
import { QueryCtx } from "../../_generated/server";

export async function getAuthenticatedUser(
  ctx: QueryCtx
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
