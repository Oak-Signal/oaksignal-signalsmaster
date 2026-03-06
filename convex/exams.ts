import { v } from "convex/values";
import { mutation, query, MutationCtx, QueryCtx } from "./_generated/server";
import { Doc } from "./_generated/dataModel";
import {
  buildExamPolicySnapshot,
  estimateExamDurationMinutes,
  OFFICIAL_EXAM_MIN_RULES_VIEW_DURATION_MS,
  OFFICIAL_EXAM_MIN_PRACTICE_SESSIONS,
  SUPPORTED_BROWSERS,
} from "./lib/exam_policy";
import {
  getExamAcknowledgementErrors,
  getExamStartBlockers,
} from "./lib/exam_start_validators";

type AuthenticatedCtx = QueryCtx | MutationCtx;

interface ExamStartData {
  totalQuestions: number;
  expectedDurationMinutes: number;
  totalPracticeSessions: number;
  practiceAveragePercent: number;
  latestAttempt: Doc<"examAttempts"> | null;
  hasOfficialAttempt: boolean;
  blockers: string[];
}

async function getAuthenticatedUser(ctx: AuthenticatedCtx): Promise<Doc<"users"> | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return null;
  }

  return ctx.db
    .query("users")
    .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
    .unique();
}

async function getExamStartData(
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
    userRole: user.role,
    totalQuestions,
    userPracticeSessions: totalPracticeSessions,
    hasOfficialAttempt,
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

export const getExamStartContext = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user) {
      return null;
    }

    const startData = await getExamStartData(ctx, user);
    const examPolicy = buildExamPolicySnapshot(startData.totalQuestions);

    return {
      examPolicy,
      expectedDurationMinutes: startData.expectedDurationMinutes,
      minimumRulesViewDurationMs: OFFICIAL_EXAM_MIN_RULES_VIEW_DURATION_MS,
      prerequisite: {
        minimumPracticeSessions: OFFICIAL_EXAM_MIN_PRACTICE_SESSIONS,
        userPracticeSessions: startData.totalPracticeSessions,
        userPracticeAveragePercent: startData.practiceAveragePercent,
        met: startData.totalPracticeSessions >= OFFICIAL_EXAM_MIN_PRACTICE_SESSIONS,
      },
      eligibility: {
        canStart: startData.blockers.length === 0,
        blockers: startData.blockers,
      },
      systemRequirements: {
        stableInternetRequired: true,
        recommendedBrowsers: [...SUPPORTED_BROWSERS],
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

export const startOfficialExamAttempt = mutation({
  args: {
    rulesAcknowledged: v.boolean(),
    readinessAcknowledged: v.boolean(),
    rulesViewDurationMs: v.number(),
    stableInternetConfirmed: v.boolean(),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    browserFamily: v.optional(v.string()),
    browserVersion: v.optional(v.string()),
    browserSupported: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user) {
      throw new Error("Must be authenticated to start an official exam attempt.");
    }

    const startData = await getExamStartData(ctx, user);
    if (startData.blockers.length > 0) {
      throw new Error(startData.blockers[0]);
    }

    const acknowledgementErrors = getExamAcknowledgementErrors({
      rulesAcknowledged: args.rulesAcknowledged,
      readinessAcknowledged: args.readinessAcknowledged,
      rulesViewDurationMs: args.rulesViewDurationMs,
      minimumRulesViewDurationMs: OFFICIAL_EXAM_MIN_RULES_VIEW_DURATION_MS,
    });

    if (acknowledgementErrors.length > 0) {
      throw new Error(acknowledgementErrors[0]);
    }

    const now = Date.now();
    const examPolicy = buildExamPolicySnapshot(startData.totalQuestions);

    const examAttemptId = await ctx.db.insert("examAttempts", {
      userId: user._id,
      status: "started",
      attemptNumber: (startData.latestAttempt?.attemptNumber ?? 0) + 1,
      rulesAcknowledgedAt: now,
      readinessAcknowledgedAt: now,
      rulesViewDurationMs: args.rulesViewDurationMs,
      policySnapshot: examPolicy,
      prerequisiteSnapshot: {
        minimumPracticeSessionsRequired: OFFICIAL_EXAM_MIN_PRACTICE_SESSIONS,
        userPracticeSessions: startData.totalPracticeSessions,
        userPracticeAveragePercent: startData.practiceAveragePercent,
      },
      systemSnapshot: {
        ipAddress: args.ipAddress,
        userAgent: args.userAgent,
        browserFamily: args.browserFamily,
        browserVersion: args.browserVersion,
        browserSupported: args.browserSupported ?? false,
        stableInternetConfirmed: args.stableInternetConfirmed,
      },
      startedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    return {
      examAttemptId,
      startedAt: now,
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

export const getAttemptById = query({
  args: {
    examAttemptId: v.id("examAttempts"),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user) {
      return null;
    }

    const attempt = await ctx.db.get(args.examAttemptId);
    if (!attempt || attempt.userId !== user._id) {
      return null;
    }

    return {
      examAttemptId: attempt._id,
      attemptNumber: attempt.attemptNumber,
      status: attempt.status,
      startedAt: attempt.startedAt,
      completedAt: attempt.completedAt ?? null,
      rulesAcknowledgedAt: attempt.rulesAcknowledgedAt,
      readinessAcknowledgedAt: attempt.readinessAcknowledgedAt,
      rulesViewDurationMs: attempt.rulesViewDurationMs,
      policySnapshot: attempt.policySnapshot,
      prerequisiteSnapshot: attempt.prerequisiteSnapshot,
      systemSnapshot: attempt.systemSnapshot,
    };
  },
});
