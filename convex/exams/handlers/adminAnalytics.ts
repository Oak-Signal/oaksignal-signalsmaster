import { v } from "convex/values";
import { query } from "../../_generated/server";
import { getAuthenticatedUser } from "../services/auth";
import { buildAdminPerformanceAnalytics } from "../services/performance_analytics";

export const getAdminPerformanceAnalytics = query({
  args: {
    range: v.optional(v.union(v.literal("7d"), v.literal("30d"), v.literal("90d"))),
    compareRange: v.optional(
      v.union(v.literal("7d"), v.literal("30d"), v.literal("90d"))
    ),
    groupBy: v.optional(v.union(v.literal("role"), v.literal("rank"))),
    timeZone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user || user.role !== "admin") {
      return null;
    }

    const range = args.range ?? "30d";

    return buildAdminPerformanceAnalytics(ctx, {
      range,
      compareRange: args.compareRange ?? range,
      groupBy: args.groupBy ?? "role",
      timeZone: args.timeZone,
    });
  },
});
