import { v } from "convex/values";
import { query } from "../../_generated/server";
import { getAuthenticatedUser } from "../services/auth";
import {
  buildAdminExamActivityTimeline,
  getAdminTimelineRangeDays,
  normalizeAdminTimelineTimeZone,
} from "../services/activity-timeline";
import { roundToTwoDecimals } from "../services/time";

export const getAdminExamOverviewStats = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user || user.role !== "admin") {
      return null;
    }

    const results = await ctx.db
      .query("examResults")
      .withIndex("by_completedAt")
      .collect();

    const totalExamsAdministered = results.length;
    if (totalExamsAdministered === 0) {
      return {
        totalExamsAdministered: 0,
        overallPassRatePercent: 0,
        averageScorePercent: 0,
        uniqueTestTakers: 0,
        generatedAt: Date.now(),
      };
    }

    let passedCount = 0;
    let totalScore = 0;
    const uniqueUserIds = new Set<string>();

    for (const result of results) {
      if (result.passed) {
        passedCount += 1;
      }

      totalScore += result.scorePercent;
      uniqueUserIds.add(result.userId.toString());
    }

    const overallPassRatePercent = roundToTwoDecimals(
      (passedCount / totalExamsAdministered) * 100
    );
    const averageScorePercent = roundToTwoDecimals(
      totalScore / totalExamsAdministered
    );

    return {
      totalExamsAdministered,
      overallPassRatePercent,
      averageScorePercent,
      uniqueTestTakers: uniqueUserIds.size,
      generatedAt: Date.now(),
    };
  },
});

export const getAdminExamActivityTimeline = query({
  args: {
    range: v.optional(v.union(v.literal("7d"), v.literal("30d"), v.literal("90d"))),
    view: v.optional(v.union(v.literal("daily"), v.literal("weekly"), v.literal("monthly"))),
    timeZone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user || user.role !== "admin") {
      return null;
    }

    const range = args.range ?? "30d";
    const view = args.view ?? "daily";
    const timeZone = normalizeAdminTimelineTimeZone(args.timeZone);

    const rangeDays = getAdminTimelineRangeDays(range);
    const cutoff = Date.now() - (rangeDays + 2) * 24 * 60 * 60 * 1000;

    const results = await ctx.db
      .query("examResults")
      .withIndex("by_completedAt", (q) => q.gte("completedAt", cutoff))
      .collect();

    return buildAdminExamActivityTimeline({
      results: results.map((result) => ({
        completedAt: result.completedAt,
        passed: result.passed,
      })),
      range,
      view,
      timeZone,
    });
  },
});
