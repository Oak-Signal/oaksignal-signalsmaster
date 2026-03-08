import { Doc, Id } from "../../_generated/dataModel";
import { QueryCtx } from "../../_generated/server";

export async function getCompletedSessions(
  ctx: QueryCtx,
  userId: Id<"users">,
  order: "asc" | "desc" = "desc"
): Promise<Doc<"practiceSessions">[]> {
  return ctx.db
    .query("practiceSessions")
    .withIndex("by_user_status", (q) =>
      q.eq("userId", userId).eq("status", "completed")
    )
    .order(order)
    .collect();
}
