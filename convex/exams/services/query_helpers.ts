import { Doc } from "../../_generated/dataModel";
import { buildExamPolicySnapshot, estimateExamDurationMinutes, OFFICIAL_EXAM_MIN_PRACTICE_SESSIONS, OFFICIAL_EXAM_MIN_RULES_VIEW_DURATION_MS, SUPPORTED_BROWSERS } from "../../lib/exam_policy";
import { getExamStartBlockers } from "../../lib/exam_start_validators";
import { ExamModeStrategy, ExamQuestionMode } from "../../lib/exam_types";
import { AuthenticatedCtx } from "./auth";

export interface ExamStartData {
  totalQuestions: number;
  expectedDurationMinutes: number;
  totalPracticeSessions: number;
  practiceAveragePercent: number;
  latestAttempt: Doc<"examAttempts"> | null;
  hasOfficialAttempt: boolean;
  blockers: string[];
}

export interface ExamGenerationSettings {
  modeStrategy: ExamModeStrategy;
  singleMode?: ExamQuestionMode;
}

export const EXAM_START_CONSTANTS = {
  OFFICIAL_EXAM_MIN_RULES_VIEW_DURATION_MS,
  OFFICIAL_EXAM_MIN_PRACTICE_SESSIONS,
  SUPPORTED_BROWSERS,
} as const;

export function buildExamPolicy(totalQuestions: number) {
  return buildExamPolicySnapshot(totalQuestions);
}

export async function resolveExamGenerationSettings(
  ctx: AuthenticatedCtx
): Promise<ExamGenerationSettings> {
  const settings = await ctx.db
    .query("examSettings")
    .withIndex("by_updatedAt")
    .order("desc")
    .first();

  if (!settings) {
    return {
      modeStrategy: "alternating",
    };
  }

  return {
    modeStrategy: settings.modeStrategy,
    singleMode: settings.modeStrategy === "single" ? settings.singleMode : undefined,
  };
}

export async function getAttemptQuestions(
  ctx: AuthenticatedCtx,
  examAttemptId: Doc<"examAttempts">["_id"]
): Promise<Doc<"examQuestions">[]> {
  return ctx.db
    .query("examQuestions")
    .withIndex("by_attempt", (q) => q.eq("examAttemptId", examAttemptId))
    .collect();
}

export function mapImmutableResultToAttemptResult(result: Doc<"examResults">): {
  totalQuestions: number;
  correctCount: number;
  scorePercent: number;
  passed: boolean;
  modeStats?: {
    learn: { total: number; correct: number; incorrect: number };
    match: { total: number; correct: number; incorrect: number };
  };
  categoryStats?: Array<{ category: string; total: number; correct: number; incorrect: number }>;
} {
  return {
    totalQuestions: result.totalQuestions,
    correctCount: result.totalCorrect,
    scorePercent: result.scorePercent,
    passed: result.passed,
    modeStats: result.modeStats,
    categoryStats: result.categoryStats,
  };
}

export async function getImmutableResultForAttempt(
  ctx: AuthenticatedCtx,
  attempt: Doc<"examAttempts">
): Promise<Doc<"examResults"> | null> {
  if (attempt.examResultId) {
    const linked = await ctx.db.get(attempt.examResultId);
    if (linked) {
      return linked;
    }
  }

  return ctx.db
    .query("examResults")
    .withIndex("by_attempt", (q) => q.eq("examAttemptId", attempt._id))
    .first();
}

export async function resolveFlagPrompt(
  ctx: AuthenticatedCtx,
  attempt: Doc<"examAttempts">,
  question: Doc<"examQuestions">
): Promise<{ imagePath?: string; meaning?: string }> {
  const flag = await ctx.db.get(question.flagId);
  if (flag) {
    return question.mode === "learn"
      ? { imagePath: flag.imagePath }
      : { meaning: flag.meaning };
  }

  const snapshotFlag = attempt.flagSnapshot?.find((item) => item.flagId === question.flagId);
  if (!snapshotFlag) {
    throw new Error("Unable to resolve question prompt for this exam attempt.");
  }

  return question.mode === "learn"
    ? { imagePath: snapshotFlag.imagePath }
    : { meaning: snapshotFlag.meaning };
}

export async function getExamStartData(
  ctx: AuthenticatedCtx,
  user: Doc<"users">
): Promise<ExamStartData> {
  const allFlags = await ctx.db
    .query("flags")
    .withIndex("by_order")
    .collect();

  const totalQuestions = allFlags.length;
  const expectedDurationMinutes = estimateExamDurationMinutes(totalQuestions);

  const completedPracticeSessions = await ctx.db
    .query("practiceSessions")
    .withIndex("by_user_status", (q) =>
      q.eq("userId", user._id).eq("status", "completed")
    )
    .collect();

  const totalPracticeSessions = completedPracticeSessions.length;
  const practiceAveragePercent =
    totalPracticeSessions > 0
      ? Math.round(
          completedPracticeSessions.reduce((sum, session) => sum + session.score, 0) /
            totalPracticeSessions
        )
      : 0;

  const latestAttempt = await ctx.db
    .query("examAttempts")
    .withIndex("by_user_startedAt", (q) => q.eq("userId", user._id))
    .order("desc")
    .first();

  const hasOfficialAttempt = Boolean(latestAttempt);

  const blockers = getExamStartBlockers({
    totalQuestions,
    userPracticeSessions: totalPracticeSessions,
  });

  return {
    totalQuestions,
    expectedDurationMinutes,
    totalPracticeSessions,
    practiceAveragePercent,
    latestAttempt,
    hasOfficialAttempt,
    blockers,
  };
}
