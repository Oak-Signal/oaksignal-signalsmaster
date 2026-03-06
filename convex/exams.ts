import { v } from "convex/values";
import { query, QueryCtx } from "./_generated/server";
import { Doc } from "./_generated/dataModel";
import {
  buildExamPolicySnapshot,
  estimateExamDurationMinutes,
  OFFICIAL_EXAM_MIN_PRACTICE_SESSIONS,
  OFFICIAL_EXAM_MIN_RULES_VIEW_DURATION_MS,
  SUPPORTED_BROWSERS,
} from "./lib/exam_policy";

async function getAuthenticatedUser(ctx: QueryCtx): Promise<Doc<"users"> | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return null;
  }

  return ctx.db
    .query("users")
    .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
    .unique();
}

export const getExamStartContext = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user) {
      return null;
    }

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
    const meetsPracticeRequirement =
      totalPracticeSessions >= OFFICIAL_EXAM_MIN_PRACTICE_SESSIONS;

    const blockers: string[] = [];
    if (totalQuestions === 0) {
      blockers.push("Exam is unavailable because no flags are currently loaded.");
    }
    if (!meetsPracticeRequirement) {
      blockers.push(
        `Complete at least ${OFFICIAL_EXAM_MIN_PRACTICE_SESSIONS} practice sessions before starting the official exam.`
      );
    }
    if (hasOfficialAttempt) {
      blockers.push("You already have an official exam attempt on record.");
    }

    const examPolicy = buildExamPolicySnapshot(totalQuestions);

    return {
      examPolicy,
      expectedDurationMinutes,
      minimumRulesViewDurationMs: OFFICIAL_EXAM_MIN_RULES_VIEW_DURATION_MS,
      prerequisite: {
        minimumPracticeSessions: OFFICIAL_EXAM_MIN_PRACTICE_SESSIONS,
        userPracticeSessions: totalPracticeSessions,
        userPracticeAveragePercent: practiceAveragePercent,
        met: meetsPracticeRequirement,
      },
      eligibility: {
        canStart: blockers.length === 0,
        blockers,
      },
      systemRequirements: {
        stableInternetRequired: true,
        recommendedBrowsers: [...SUPPORTED_BROWSERS],
      },
      proctorInfo: null,
      motivationalMessage: "You've prepared well, good luck!",
      attemptSummary: {
        hasOfficialAttempt,
        latestAttemptStatus: latestAttempt?.status ?? null,
        latestStartedAt: latestAttempt?.startedAt ?? null,
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

    return attempts.map((attempt) => ({
      examAttemptId: attempt._id,
      attemptNumber: attempt.attemptNumber,
      status: attempt.status,
      startedAt: attempt.startedAt,
      completedAt: attempt.completedAt ?? null,
      scorePercent: attempt.result?.scorePercent ?? null,
      passed: attempt.result?.passed ?? null,
    }));
  },
});
