import { v } from "convex/values";
import { mutation, MutationCtx } from "./_generated/server";
import { Doc } from "./_generated/dataModel";
import {
  assertAdminUser,
  canAccessResultRecord,
  getAuthenticatedUser,
  getOwnedAttempt,
} from "./exams/services/auth";
import {
  insertExamAuditLog,
  insertExamResultAccessLog,
} from "./exams/services/audit";
import {
  roundToTwoDecimals,
} from "./exams/services/time";
import { sha256Hex, stableStringify } from "./exams/services/hash";
import {
  getAttemptQuestions,
} from "./exams/services/query_helpers";
import {
  buildCertificateNumber,
  buildCompletedExamStats,
  buildQuestionBreakdownFromAttempt,
} from "./exams/services/result_builder";

export { getExamStartContext, getAttemptHistory } from "./exams/handlers/start";
export { getExamGenerationSettings } from "./exams/handlers/settings";
export {
  getAttemptRuntimeProgress,
  getCurrentAttemptQuestion,
  getAttemptPreload,
  getAttemptById,
} from "./exams/handlers/runtime";
export { startOfficialExamAttempt } from "./exams/handlers/startMutation";
export { submitExamAnswer } from "./exams/handlers/submission";

function mapOfficialResultRecord(result: Doc<"examResults">) {
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
    flagDatabaseSnapshot: result.flagDatabaseSnapshot,
    questionBreakdown: result.questionBreakdown,
    recordChecksum: result.recordChecksum,
    signatureAlgorithm: result.signatureAlgorithm,
    signature: result.signature,
    createdAt: result.createdAt,
  };
}


function buildCanonicalOfficialResultPayload(result: Doc<"examResults">) {
  return {
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
}

async function buildPercentileRanking(
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
  const percentile = roundToTwoDecimals(
    ((lowerCount + 0.5 * equalCount) / cohortSize) * 100
  );

  return {
    percentile,
    cohortSize,
    cohortLabel: "All official test takers (all-time)",
    method: "score_midrank_global_all_time",
  };
}



export const setExamGenerationSettings = mutation({
  args: {
    modeStrategy: v.union(v.literal("alternating"), v.literal("single")),
    singleMode: v.optional(v.union(v.literal("learn"), v.literal("match"))),
  },
  handler: async (ctx, args) => {
    const adminUser = await assertAdminUser(ctx);

    if (args.modeStrategy === "single" && !args.singleMode) {
      throw new Error("singleMode is required when modeStrategy is set to single.");
    }

    if (args.modeStrategy === "alternating" && args.singleMode !== undefined) {
      throw new Error("singleMode must not be provided when using alternating mode.");
    }

    const now = Date.now();

    const existing = await ctx.db
      .query("examSettings")
      .withIndex("by_updatedAt")
      .order("desc")
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        modeStrategy: args.modeStrategy,
        singleMode: args.modeStrategy === "single" ? args.singleMode : undefined,
        updatedBy: adminUser._id,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("examSettings", {
        modeStrategy: args.modeStrategy,
        singleMode: args.modeStrategy === "single" ? args.singleMode : undefined,
        updatedBy: adminUser._id,
        updatedAt: now,
        createdAt: now,
      });
    }

    return {
      modeStrategy: args.modeStrategy,
      singleMode: args.modeStrategy === "single" ? args.singleMode : undefined,
      updatedAt: now,
    };
  },
});

export const getMyOfficialResult = mutation({
  args: {
    examAttemptId: v.id("examAttempts"),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user) {
      return null;
    }

    const result = await ctx.db
      .query("examResults")
      .withIndex("by_attempt", (q) => q.eq("examAttemptId", args.examAttemptId))
      .first();

    if (!result) {
      return null;
    }

    if (!canAccessResultRecord(user, result)) {
      await insertExamResultAccessLog(ctx, {
        result,
        actorUser: user,
        accessType: "result_access_denied",
        metadata: {
          endpoint: "getMyOfficialResult",
          reason: "access_denied",
          examAttemptId: args.examAttemptId,
        },
      });
      return null;
    }

    await insertExamResultAccessLog(ctx, {
      result,
      actorUser: user,
      accessType: "result_read",
      metadata: {
        endpoint: "getMyOfficialResult",
        examAttemptId: args.examAttemptId,
      },
    });

    const percentileRanking = await buildPercentileRanking(ctx, result);

    return {
      ...mapOfficialResultRecord(result),
      percentileRanking,
    };
  },
});

export const getMyOfficialResultsHistory = mutation({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user) {
      return null;
    }

    const limit = args.limit ?? 20;
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new Error("Limit must be an integer between 1 and 100");
    }

    if (user.role === "admin") {
      const results = await ctx.db
        .query("examResults")
        .withIndex("by_completedAt")
        .order("desc")
        .take(limit);

      for (const result of results) {
        await insertExamResultAccessLog(ctx, {
          result,
          actorUser: user,
          accessType: "result_list",
          metadata: {
            endpoint: "getMyOfficialResultsHistory",
            scope: "admin_all",
            requestedLimit: limit,
          },
        });
      }

      return results.map((result) => ({
        examResultId: result._id,
        examAttemptId: result.examAttemptId,
        userId: result.userId,
        fullName: result.userSnapshot.fullName,
        attemptNumber: result.attemptNumber,
        completedAt: result.completedAt,
        scorePercent: result.scorePercent,
        passed: result.passed,
        certificateNumber: result.certificateNumber,
      }));
    }

    const ownResults = await ctx.db
      .query("examResults")
      .withIndex("by_user_completedAt", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(limit);

    for (const result of ownResults) {
      await insertExamResultAccessLog(ctx, {
        result,
        actorUser: user,
        accessType: "result_list",
        metadata: {
          endpoint: "getMyOfficialResultsHistory",
          scope: "cadet_own",
          requestedLimit: limit,
        },
      });
    }

    return ownResults.map((result) => ({
      examResultId: result._id,
      examAttemptId: result.examAttemptId,
      userId: result.userId,
      fullName: result.userSnapshot.fullName,
      attemptNumber: result.attemptNumber,
      completedAt: result.completedAt,
      scorePercent: result.scorePercent,
      passed: result.passed,
      certificateNumber: result.certificateNumber,
    }));
  },
});

export const getOfficialResultForAdminReview = mutation({
  args: {
    examResultId: v.id("examResults"),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user) {
      return null;
    }

    const result = await ctx.db.get(args.examResultId);
    if (!result) {
      return null;
    }

    if (user.role !== "admin") {
      await insertExamResultAccessLog(ctx, {
        result,
        actorUser: user,
        accessType: "result_access_denied",
        metadata: {
          endpoint: "getOfficialResultForAdminReview",
          reason: "admin_required",
          requestedResultId: args.examResultId,
        },
      });
      return null;
    }

    await insertExamResultAccessLog(ctx, {
      result,
      actorUser: user,
      accessType: "result_read",
      metadata: {
        endpoint: "getOfficialResultForAdminReview",
        requestedResultId: args.examResultId,
      },
    });

    const percentileRanking = await buildPercentileRanking(ctx, result);

    return {
      ...mapOfficialResultRecord(result),
      percentileRanking,
    };
  },
});

export const getOfficialResultByCertificate = mutation({
  args: {
    certificateNumber: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user) {
      return null;
    }

    const result = await ctx.db
      .query("examResults")
      .withIndex("by_certificate", (q) => q.eq("certificateNumber", args.certificateNumber))
      .first();

    if (!result) {
      return null;
    }

    if (!canAccessResultRecord(user, result)) {
      await insertExamResultAccessLog(ctx, {
        result,
        actorUser: user,
        accessType: "result_access_denied",
        metadata: {
          endpoint: "getOfficialResultByCertificate",
          reason: "access_denied",
          certificateNumber: args.certificateNumber,
        },
      });
      return null;
    }

    await insertExamResultAccessLog(ctx, {
      result,
      actorUser: user,
      accessType: "result_read",
      metadata: {
        endpoint: "getOfficialResultByCertificate",
        certificateNumber: args.certificateNumber,
      },
    });

    const percentileRanking = await buildPercentileRanking(ctx, result);

    return {
      ...mapOfficialResultRecord(result),
      percentileRanking,
    };
  },
});

export const verifyOfficialResultIntegrity = mutation({
  args: {
    examResultId: v.id("examResults"),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user) {
      return null;
    }

    const result = await ctx.db.get(args.examResultId);
    if (!result) {
      return null;
    }

    if (!canAccessResultRecord(user, result)) {
      await insertExamResultAccessLog(ctx, {
        result,
        actorUser: user,
        accessType: "result_access_denied",
        metadata: {
          endpoint: "verifyOfficialResultIntegrity",
          reason: "access_denied",
          examResultId: args.examResultId,
        },
      });
      return null;
    }

    const canonicalPayload = buildCanonicalOfficialResultPayload(result);
    const canonicalJson = stableStringify(canonicalPayload);
    const recomputedChecksum = await sha256Hex(canonicalJson);
    const checksumMatches = recomputedChecksum === result.recordChecksum;
    const signatureMatches =
      result.signatureAlgorithm === "sha256" && result.signature === recomputedChecksum;
    const isValid = checksumMatches && signatureMatches;

    await insertExamResultAccessLog(ctx, {
      result,
      actorUser: user,
      accessType: "result_verify",
      metadata: {
        endpoint: "verifyOfficialResultIntegrity",
        examResultId: args.examResultId,
        checksumMatches,
        signatureMatches,
        isValid,
      },
    });

    return {
      examResultId: result._id,
      examAttemptId: result.examAttemptId,
      certificateNumber: result.certificateNumber,
      checksumMatches,
      signatureMatches,
      isValid,
      storedChecksum: result.recordChecksum,
      recomputedChecksum,
      signatureAlgorithm: result.signatureAlgorithm,
      verifiedAt: Date.now(),
    };
  },
});

export const backfillImmutableResults = mutation({
  args: {
    limit: v.optional(v.number()),
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const adminUser = await assertAdminUser(ctx);

    const limit = args.limit ?? 50;
    if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
      throw new Error("Limit must be an integer between 1 and 500");
    }

    const dryRun = args.dryRun ?? false;
    const completedAttempts = await ctx.db
      .query("examAttempts")
      .withIndex("by_status_startedAt", (q) => q.eq("status", "completed"))
      .order("desc")
      .take(limit);

    const summary = {
      scanned: completedAttempts.length,
      created: 0,
      linkedExisting: 0,
      skippedMissingData: 0,
      dryRun,
    };

    for (const attempt of completedAttempts) {
      if (attempt.examResultId) {
        summary.linkedExisting += 1;
        continue;
      }

      const user = await ctx.db.get(attempt.userId);
      if (!user || !attempt.completedAt) {
        summary.skippedMissingData += 1;
        continue;
      }

      const sortedQuestions = (await getAttemptQuestions(ctx, attempt._id))
        .slice()
        .sort((a, b) => a.questionIndex - b.questionIndex);

      if (sortedQuestions.length === 0) {
        summary.skippedMissingData += 1;
        continue;
      }

      const totalQuestions = sortedQuestions.length;
      const totalCorrect = sortedQuestions.filter((item) => item.isCorrect === true).length;
      const scorePercent = totalQuestions > 0
        ? roundToTwoDecimals((totalCorrect / totalQuestions) * 100)
        : 0;
      const passed = scorePercent >= attempt.policySnapshot.passThresholdPercent;
      const { modeStats, categoryStats } = buildCompletedExamStats(sortedQuestions, attempt);
      const examModesUsed = [...new Set(sortedQuestions.map((question) => question.mode))];
      const questionBreakdown = await buildQuestionBreakdownFromAttempt(ctx, {
        attempt,
        sortedQuestions,
      });

      const certificateNumber = buildCertificateNumber({
        completedAt: attempt.completedAt,
        attemptNumber: attempt.attemptNumber,
        examAttemptId: String(attempt._id),
      });

      const roleAtExam: "cadet" | "admin" = user.role === "admin" ? "admin" : "cadet";
      const generationSnapshot = attempt.generationSnapshot;
      const canonicalPayload = {
        examAttemptId: attempt._id,
        userId: user._id,
        immutable: true,
        immutableAt: attempt.immutableAt ?? attempt.completedAt,
        certificateNumber,
        resultVersion: 1,
        userSnapshot: {
          userId: user._id,
          fullName: user.name?.trim() || user.email,
          roleAtExam,
        },
        attemptNumber: attempt.attemptNumber,
        startedAt: attempt.startedAt,
        completedAt: attempt.completedAt,
        totalQuestions,
        totalCorrect,
        scorePercent,
        passThresholdPercent: attempt.policySnapshot.passThresholdPercent,
        passed,
        examModesUsed,
        modeStats,
        categoryStats,
        flagDatabaseSnapshot: {
          generationVersion: generationSnapshot?.generationVersion ?? 1,
          examChecksum: generationSnapshot?.examChecksum ?? "unknown",
          questionCount: generationSnapshot?.questionCount ?? totalQuestions,
          modeStrategy: generationSnapshot?.modeStrategy ?? "alternating",
          singleMode: generationSnapshot?.singleMode,
          generationStartedAt: generationSnapshot?.generationStartedAt ?? attempt.startedAt,
          generationCompletedAt: generationSnapshot?.generationCompletedAt ?? attempt.startedAt,
          generationTimeMs: generationSnapshot?.generationTimeMs ?? 0,
          generationRetryCount: generationSnapshot?.generationRetryCount ?? 0,
        },
        questionBreakdown,
      };

      const canonicalJson = stableStringify(canonicalPayload);
      const recordChecksum = await sha256Hex(canonicalJson);

      if (!dryRun) {
        const examResultId = await ctx.db.insert("examResults", {
          ...canonicalPayload,
          recordChecksum,
          signatureAlgorithm: "sha256",
          signature: recordChecksum,
          createdAt: attempt.completedAt,
        });

        await ctx.db.patch(attempt._id, {
          examResultId,
          immutableAt: attempt.immutableAt ?? attempt.completedAt,
          updatedAt: Date.now(),
        });

        await insertExamAuditLog(ctx, {
          examAttemptId: attempt._id,
          userId: adminUser._id,
          eventType: "result_backfilled",
          message: "Backfilled immutable official result record for completed attempt.",
          metadata: {
            source: "backfillImmutableResults",
            examResultId,
          },
        });
      }

      summary.created += 1;
    }

    return summary;
  },
});

const CLIENT_SECURITY_EVENT_TYPES = [
  "connection_lost",
  "connection_restored",
  "window_blur",
  "window_focus",
  "tab_hidden",
  "tab_visible",
  "fullscreen_entered",
  "fullscreen_exited",
  "back_navigation_blocked",
  "restricted_shortcut_blocked",
  "idle_warning_shown",
  "idle_timeout_triggered",
] as const;

export const logExamClientEvent = mutation({
  args: {
    examAttemptId: v.id("examAttempts"),
    eventType: v.union(
      v.literal("connection_lost"),
      v.literal("connection_restored"),
      v.literal("window_blur"),
      v.literal("window_focus"),
      v.literal("tab_hidden"),
      v.literal("tab_visible"),
      v.literal("fullscreen_entered"),
      v.literal("fullscreen_exited"),
      v.literal("back_navigation_blocked"),
      v.literal("restricted_shortcut_blocked"),
      v.literal("idle_warning_shown"),
      v.literal("idle_timeout_triggered")
    ),
    message: v.string(),
    metadataJson: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user) {
      throw new Error("Authentication is required.");
    }

    const attempt = await getOwnedAttempt(ctx, user._id, args.examAttemptId);
    if (!attempt) {
      throw new Error("Exam attempt not found or access denied.");
    }

    if (attempt.immutableAt !== undefined || attempt.status !== "started") {
      await insertExamAuditLog(ctx, {
        examAttemptId: attempt._id,
        userId: user._id,
        eventType: "immutable_write_blocked",
        message: "Blocked client security mutation against immutable or finalized exam attempt.",
        metadata: {
          requestedEventType: args.eventType,
          attemptStatus: attempt.status,
          immutableAt: attempt.immutableAt,
        },
      });

      throw new Error("This exam attempt has been finalized and cannot be modified.");
    }

    if (!CLIENT_SECURITY_EVENT_TYPES.includes(args.eventType)) {
      throw new Error("Unsupported client security event type.");
    }

    let parsedMetadata: Record<string, unknown> | undefined;
    if (args.metadataJson) {
      if (args.metadataJson.length > 4000) {
        throw new Error("metadataJson exceeds maximum length.");
      }

      try {
        const raw = JSON.parse(args.metadataJson) as unknown;
        if (raw && typeof raw === "object" && !Array.isArray(raw)) {
          parsedMetadata = raw as Record<string, unknown>;
        }
      } catch {
        throw new Error("metadataJson must be valid JSON.");
      }
    }

    await insertExamAuditLog(ctx, {
      examAttemptId: attempt._id,
      userId: user._id,
      eventType: args.eventType,
      message: args.message,
      metadata: parsedMetadata,
    });

    return {
      success: true,
      loggedAt: Date.now(),
    };
  },
});

