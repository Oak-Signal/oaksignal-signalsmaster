import { Doc } from "../../_generated/dataModel";
import { MutationCtx } from "../../_generated/server";
import { roundToTwoDecimals } from "./time";

export function mapOfficialResultRecord(result: Doc<"examResults">) {
  return {
    examResultId: result._id,
    examAttemptId: result.examAttemptId,
    userId: result.userId,
    immutable: result.immutable,
    immutableAt: result.immutableAt,
    certificateNumber: result.certificateNumber,
    resultVersion: result.resultVersion,
    userSnapshot: result.userSnapshot,
    attemptNumber: result.attemptNumber,
    startedAt: result.startedAt,
    completedAt: result.completedAt,
    totalQuestions: result.totalQuestions,
    totalCorrect: result.totalCorrect,
    scorePercent: result.scorePercent,
    passThresholdPercent: result.passThresholdPercent,
    passed: result.passed,
    examModesUsed: result.examModesUsed,
    modeStats: result.modeStats,
    categoryStats: result.categoryStats,
    hasIntegrityFlags: result.hasIntegrityFlags,
    integrityScore: result.integrityScore,
    integritySeverity: result.integritySeverity,
    integritySignals: result.integritySignals,
    investigationNotes: result.investigationNotes,
    flagDatabaseSnapshot: result.flagDatabaseSnapshot,
    questionBreakdown: result.questionBreakdown,
    recordChecksum: result.recordChecksum,
    signatureAlgorithm: result.signatureAlgorithm,
    signature: result.signature,
    createdAt: result.createdAt,
  };
}

export function buildCanonicalOfficialResultPayload(result: Doc<"examResults">) {
  const basePayload = {
    examAttemptId: result.examAttemptId,
    userId: result.userId,
    immutable: result.immutable,
    immutableAt: result.immutableAt,
    certificateNumber: result.certificateNumber,
    resultVersion: result.resultVersion,
    userSnapshot: result.userSnapshot,
    attemptNumber: result.attemptNumber,
    startedAt: result.startedAt,
    completedAt: result.completedAt,
    totalQuestions: result.totalQuestions,
    totalCorrect: result.totalCorrect,
    scorePercent: result.scorePercent,
    passThresholdPercent: result.passThresholdPercent,
    passed: result.passed,
    examModesUsed: result.examModesUsed,
    modeStats: result.modeStats,
    categoryStats: result.categoryStats,
    flagDatabaseSnapshot: result.flagDatabaseSnapshot,
    questionBreakdown: result.questionBreakdown,
  };

  if (result.resultVersion >= 2) {
    return {
      ...basePayload,
      hasIntegrityFlags: result.hasIntegrityFlags,
      integrityScore: result.integrityScore,
      integritySeverity: result.integritySeverity,
      integritySignals: result.integritySignals,
      investigationNotes: result.investigationNotes,
    };
  }

  return basePayload;
}

export async function buildPercentileRanking(
  ctx: MutationCtx,
  result: Doc<"examResults">
): Promise<{
  percentile: number;
  cohortSize: number;
  cohortLabel: string;
  method: "score_midrank_global_all_time";
}> {
  const allResults = await ctx.db
    .query("examResults")
    .withIndex("by_completedAt")
    .collect();

  const cohortSize = allResults.length;
  if (cohortSize === 0) {
    return {
      percentile: 0,
      cohortSize: 0,
      cohortLabel: "All official test takers (all-time)",
      method: "score_midrank_global_all_time",
    };
  }

  const score = result.scorePercent;
  const lowerCount = allResults.filter((item) => item.scorePercent < score).length;
  const equalCount = allResults.filter((item) => item.scorePercent === score).length;

  // Midrank percentile: ties share the midpoint of their score band.
  const percentile = roundToTwoDecimals(((lowerCount + 0.5 * equalCount) / cohortSize) * 100);

  return {
    percentile,
    cohortSize,
    cohortLabel: "All official test takers (all-time)",
    method: "score_midrank_global_all_time",
  };
}
