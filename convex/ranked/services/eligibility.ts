import { Doc } from "../../_generated/dataModel";
import { QueryCtx, MutationCtx } from "../../_generated/server";

type RankedCtx = QueryCtx | MutationCtx;

interface EligibilityConfig {
  rankedModeEnabled: boolean;
  requiresPassedExam: boolean;
}

export interface RankedEligibilityResult {
  isEligible: boolean;
  reasons: string[];
  hasPassedFormalExam: boolean;
}

export async function getRankedEligibility(
  ctx: RankedCtx,
  user: Doc<"users">,
  config: EligibilityConfig,
  seasonAvailable: boolean
): Promise<RankedEligibilityResult> {
  const reasons: string[] = [];

  if (!config.rankedModeEnabled) {
    reasons.push("Ranked mode is currently disabled.");
  }

  if (!seasonAvailable) {
    reasons.push("No active ranked season is currently available.");
  }

  if (user.role !== "cadet") {
    reasons.push("Ranked mode is currently available to cadet accounts only.");
  }

  let hasPassedFormalExam = false;

  if (config.requiresPassedExam) {
    const examResults = await ctx.db
      .query("examResults")
      .withIndex("by_user_completedAt", (q) => q.eq("userId", user._id))
      .order("desc")
      .collect();

    hasPassedFormalExam = examResults.some(
      (result) => result.passed && result.invalidated !== true
    );

    if (!hasPassedFormalExam) {
      reasons.push("Complete and pass a formal exam before entering ranked mode.");
    }
  } else {
    hasPassedFormalExam = true;
  }

  return {
    isEligible: reasons.length === 0,
    reasons,
    hasPassedFormalExam,
  };
}
