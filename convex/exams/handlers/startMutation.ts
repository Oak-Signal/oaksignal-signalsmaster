import { mutation } from "../../_generated/server";
import { v } from "convex/values";
import { getExamAcknowledgementErrors } from "../../lib/exam_start_validators";
import {
  applyExamAttemptToQuestions,
  generateExamQuestions,
} from "../../lib/exam_generation";
import { generateExamSeed } from "../../lib/exam_randomization";
import { issueExamSessionToken } from "../../lib/exam_session_token";
import { getAuthenticatedUser } from "../services/auth";
import { insertExamAuditLog } from "../services/audit";
import {
  EXAM_START_CONSTANTS,
  buildExamPolicy,
  getExamStartData,
  resolveExamGenerationSettings,
} from "../services/query_helpers";

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
      minimumRulesViewDurationMs: EXAM_START_CONSTANTS.OFFICIAL_EXAM_MIN_RULES_VIEW_DURATION_MS,
    });

    if (acknowledgementErrors.length > 0) {
      throw new Error(acknowledgementErrors[0]);
    }

    const requestReceivedAt = Date.now();
    const examPolicy = buildExamPolicy(startData.totalQuestions);
    const generationSettings = await resolveExamGenerationSettings(ctx);
    const allFlags = await ctx.db
      .query("flags")
      .withIndex("by_order")
      .collect();

    if (allFlags.length < 4) {
      throw new Error(
        "Exam is unavailable because at least 4 flags are required for multiple-choice questions."
      );
    }

    const attemptNumber = (startData.latestAttempt?.attemptNumber ?? 0) + 1;
    const seed = generateExamSeed({
      now: requestReceivedAt,
      attemptNumber,
      userId: user._id,
    });

    const generationStartedAt = Date.now();
    let generationRetryCount = 0;
    let generated:
      | ReturnType<typeof generateExamQuestions>
      | null = null;
    let lastGenerationError: string | null = null;

    // Retry once with a slightly modified seed if generation fails.
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        generated = generateExamQuestions(allFlags, {
          modeStrategy: generationSettings.modeStrategy,
          singleMode: generationSettings.singleMode,
          seed: seed + attempt,
          generationVersion: 1,
        });
        generationRetryCount = attempt;
        break;
      } catch (error) {
        lastGenerationError = error instanceof Error ? error.message : "Unknown generation error";
      }
    }

    if (!generated) {
      throw new Error(lastGenerationError ?? "Failed to generate official exam questions.");
    }

    const generationCompletedAt = Date.now();
    const generationTimeMs = generationCompletedAt - generationStartedAt;
    const examStartedAt = generationCompletedAt;

    const examAttemptId = await ctx.db.insert("examAttempts", {
      userId: user._id,
      status: "started",
      attemptNumber,
      rulesAcknowledgedAt: requestReceivedAt,
      readinessAcknowledgedAt: requestReceivedAt,
      rulesViewDurationMs: args.rulesViewDurationMs,
      policySnapshot: examPolicy,
      prerequisiteSnapshot: {
        minimumPracticeSessionsRequired: EXAM_START_CONSTANTS.OFFICIAL_EXAM_MIN_PRACTICE_SESSIONS,
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
      generationSnapshot: {
        ...generated.generationSnapshot,
        generationStartedAt,
        generationCompletedAt,
        generationTimeMs,
        generationRetryCount,
      },
      flagSnapshot: generated.flagSnapshot,
      startedAt: examStartedAt,
      createdAt: examStartedAt,
      updatedAt: examStartedAt,
    });

    const sessionToken = await issueExamSessionToken({
      examAttemptId: examAttemptId,
      userId: user._id,
      issuedAt: examStartedAt,
    });

    await ctx.db.patch(examAttemptId, {
      sessionTokenHash: sessionToken.tokenHash,
      sessionIssuedAt: sessionToken.issuedAt,
      sessionExpiresAt: sessionToken.expiresAt,
      updatedAt: Date.now(),
    });

    await insertExamAuditLog(ctx, {
      examAttemptId,
      userId: user._id,
      eventType: "generation_started",
      message: "Official exam question generation started.",
      metadata: {
        seed: generated.generationSnapshot.seed,
        attemptNumber,
      },
    });

    const questions = applyExamAttemptToQuestions(generated.questions, examAttemptId, user._id);
    for (const question of questions) {
      await ctx.db.insert("examQuestions", {
        ...question,
        createdAt: examStartedAt,
        updatedAt: examStartedAt,
      });
    }

    await insertExamAuditLog(ctx, {
      examAttemptId,
      userId: user._id,
      eventType: "generation_completed",
      message: "Official exam question generation completed.",
      metadata: {
        generationTimeMs,
        questionCount: questions.length,
        retryCount: generationRetryCount,
        examChecksum: generated.generationSnapshot.examChecksum,
      },
    });

    await insertExamAuditLog(ctx, {
      examAttemptId,
      userId: user._id,
      eventType: "session_token_issued",
      message: "Issued exam session token.",
      metadata: {
        issuedAt: sessionToken.issuedAt,
        expiresAt: sessionToken.expiresAt,
      },
    });

    return {
      examAttemptId,
      startedAt: examStartedAt,
      sessionToken: sessionToken.token,
      sessionExpiresAt: sessionToken.expiresAt,
    };
  },
});
