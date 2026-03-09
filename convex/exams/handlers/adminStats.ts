import { query } from "../../_generated/server";
import { getAuthenticatedUser } from "../services/auth";
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
