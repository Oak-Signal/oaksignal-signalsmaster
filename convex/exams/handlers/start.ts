import { query } from "../../_generated/server";
import {
  EXAM_START_CONSTANTS,
  buildExamPolicy,
  getExamStartData,
  getImmutableResultForAttempt,
  mapImmutableResultToAttemptResult,
  resolveExamGenerationSettings,
} from "../services/query_helpers";
import { getAuthenticatedUser } from "../services/auth";
import { v } from "convex/values";

export const getExamStartContext = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user) {
      return null;
    }

    const startData = await getExamStartData(ctx, user);
    const examPolicy = buildExamPolicy(
      startData.totalQuestions,
      startData.systemConfig.passThreshold
    );
    const generationSettings = await resolveExamGenerationSettings(ctx);

    return {
      examPolicy,
      questionModePolicy: generationSettings,
      expectedDurationMinutes: startData.expectedDurationMinutes,
      minimumRulesViewDurationMs: EXAM_START_CONSTANTS.OFFICIAL_EXAM_MIN_RULES_VIEW_DURATION_MS,
      prerequisite: {
        minimumPracticeSessions: EXAM_START_CONSTANTS.OFFICIAL_EXAM_MIN_PRACTICE_SESSIONS,
        userPracticeSessions: startData.totalPracticeSessions,
        userPracticeAveragePercent: startData.practiceAveragePercent,
        met:
          startData.totalPracticeSessions >=
          EXAM_START_CONSTANTS.OFFICIAL_EXAM_MIN_PRACTICE_SESSIONS,
      },
      eligibility: {
        canStart: startData.blockers.length === 0,
        blockers: startData.blockers,
      },
      systemRequirements: {
        stableInternetRequired: true,
        recommendedBrowsers: [...EXAM_START_CONSTANTS.SUPPORTED_BROWSERS],
      },
      proctorInfo: null,
      motivationalMessage: "You've prepared well, good luck!",
      attemptSummary: {
        hasOfficialAttempt: startData.hasOfficialAttempt,
        latestAttemptStatus: startData.latestAttempt?.status ?? null,
        latestStartedAt: startData.latestAttempt?.startedAt ?? null,
      },
    };
  },
});

export const getAttemptHistory = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user) {
      return null;
    }

    const limit = args.limit ?? 5;
    if (!Number.isInteger(limit) || limit < 1 || limit > 20) {
      throw new Error("Limit must be an integer between 1 and 20");
    }

    const attempts = await ctx.db
      .query("examAttempts")
      .withIndex("by_user_startedAt", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(limit);

    const mapped = await Promise.all(
      attempts.map(async (attempt) => {
        const immutableResult = await getImmutableResultForAttempt(ctx, attempt);
        const effectiveResult = immutableResult
          ? mapImmutableResultToAttemptResult(immutableResult)
          : (attempt.result ?? null);

        return {
          examAttemptId: attempt._id,
          attemptNumber: attempt.attemptNumber,
          status: attempt.status,
          startedAt: attempt.startedAt,
          completedAt: attempt.completedAt ?? null,
          scorePercent: effectiveResult?.scorePercent ?? null,
          passed: effectiveResult?.passed ?? null,
        };
      })
    );

    return mapped;
  },
});
