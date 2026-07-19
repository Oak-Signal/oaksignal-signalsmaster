import { MutationCtx, query, mutation } from "../../_generated/server";
import { v } from "convex/values";
import { requireAuthenticatedUser } from "../../lib/auth";
import { getResolvedSecurityPolicyConfig } from "../services/runtime";
import { Id } from "../../_generated/dataModel";

async function insertRankedTimingAudit(
  ctx: MutationCtx,
  input: {
    runId: Id<"rankedRuns">;
    userId: Id<"users">;
    questionIndex?: number;
    eventType:
      | "submission_received"
      | "submission_accepted"
      | "submission_rejected"
      | "rate_limited"
      | "timing_flagged"
      | "run_finalized"
      | "replay_flagged";
    requestReceivedAt: number;
    referenceTimestamp?: number;
    elapsedMs?: number;
    reason?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  await ctx.db.insert("rankedTimingAudit", {
    runId: input.runId,
    userId: input.userId,
    questionIndex: input.questionIndex,
    eventType: input.eventType,
    requestReceivedAt: input.requestReceivedAt,
    referenceTimestamp: input.referenceTimestamp,
    elapsedMs: input.elapsedMs,
    reason: input.reason,
    metadataJson: input.metadata ? JSON.stringify(input.metadata) : undefined,
    createdAt: input.requestReceivedAt,
  });
}

async function rejectRankedSubmission(
  ctx: MutationCtx,
  input: {
    runId: Id<"rankedRuns">;
    userId: Id<"users">;
    questionIndex: number;
    eventType: "submission_rejected" | "rate_limited" | "timing_flagged";
    reason: string;
    throwMessage: string;
    requestReceivedAt: number;
    referenceTimestamp?: number;
    elapsedMs?: number;
    metadata?: Record<string, unknown>;
  }
): Promise<never> {
  await insertRankedTimingAudit(ctx, {
    runId: input.runId,
    userId: input.userId,
    questionIndex: input.questionIndex,
    eventType: input.eventType,
    requestReceivedAt: input.requestReceivedAt,
    referenceTimestamp: input.referenceTimestamp,
    elapsedMs: input.elapsedMs,
    reason: input.reason,
    metadata: input.metadata,
  });

  throw new Error(input.throwMessage);
}

export const getRankedRunState = query({
  args: {
    runId: v.id("rankedRuns"),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthenticatedUser(ctx, "Authentication required to fetch ranked run state.");
    const run = await ctx.db.get(args.runId);

    if (!run || run.userId !== user._id) {
      return null;
    }

    return {
      runId: run._id,
      status: run.status,
      startedAt: run.startedAt,
      completedAt: run.completedAt ?? null,
      runDurationMs: run.runDurationMs ?? null,
      flagCount: run.flagCount,
      correctCount: run.correctCount,
      accuracyPercent: run.accuracyPercent,
      score: run.score,
      pointsFromTime: run.pointsFromTime,
      pointsFromAccuracy: run.pointsFromAccuracy,
      antiCheatStatus: run.antiCheatStatus,
      reviewStatus: run.reviewStatus,
      suspiciousReason: run.suspiciousReason ?? null,
    };
  },
});

export const getRankedRunQuestions = query({
  args: {
    runId: v.id("rankedRuns"),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthenticatedUser(ctx, "Authentication required to fetch ranked run questions.");
    const run = await ctx.db.get(args.runId);

    if (!run || run.userId !== user._id) {
      return null;
    }

    const questions = await ctx.db
      .query("rankedQuestions")
      .withIndex("by_run", (q) => q.eq("runId", args.runId))
      .collect();

    // Sort by question index
    const sortedQuestions = questions.sort((a, b) => a.questionIndex - b.questionIndex);

    // Resolve flag image paths for "learn" mode questions and general rendering
    const resolvedQuestions = [];
    for (const q of sortedQuestions) {
      const flag = await ctx.db.get(q.flagId);
      resolvedQuestions.push({
        questionIndex: q.questionIndex,
        flagId: q.flagId,
        flagKey: q.flagKey,
        mode: q.mode,
        options: q.options,
        userAnswer: q.userAnswer,       // For resuming active runs
        imagePath: flag?.imagePath ?? "",
        meaning: flag?.meaning ?? "",
        name: flag?.name ?? "",
      });
    }

    return resolvedQuestions;
  },
});

export const submitRankedAnswer = mutation({
  args: {
    runId: v.id("rankedRuns"),
    questionIndex: v.number(),
    selectedAnswer: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthenticatedUser(ctx, "Authentication required to submit answer.");
    const run = await ctx.db.get(args.runId);
    const now = Date.now();

    await insertRankedTimingAudit(ctx, {
      runId: args.runId,
      userId: user._id,
      questionIndex: args.questionIndex,
      eventType: "submission_received",
      requestReceivedAt: now,
    });

    if (!run || run.userId !== user._id) {
      return rejectRankedSubmission(ctx, {
        runId: args.runId,
        userId: user._id,
        questionIndex: args.questionIndex,
        eventType: "submission_rejected",
        reason: "run_not_found_or_access_denied",
        throwMessage: "Ranked run not found or access denied.",
        requestReceivedAt: now,
      });
    }

    if (run.status !== "started") {
      return rejectRankedSubmission(ctx, {
        runId: run._id,
        userId: user._id,
        questionIndex: args.questionIndex,
        eventType: "submission_rejected",
        reason: "run_not_active",
        throwMessage: "Ranked run is no longer active.",
        requestReceivedAt: now,
        metadata: {
          status: run.status,
        },
      });
    }

    const securityPolicy = getResolvedSecurityPolicyConfig();
    const expectedQuestionIndex = run.nextExpectedQuestionIndex ?? 0;

    if (args.questionIndex !== expectedQuestionIndex) {
      return rejectRankedSubmission(ctx, {
        runId: run._id,
        userId: user._id,
        questionIndex: args.questionIndex,
        eventType: "submission_rejected",
        reason: "out_of_order_submission",
        throwMessage: `Question index mismatch. Expected ${expectedQuestionIndex}, got ${args.questionIndex}.`,
        requestReceivedAt: now,
        metadata: {
          expectedQuestionIndex,
          receivedQuestionIndex: args.questionIndex,
        },
      });
    }

    const question = await ctx.db
      .query("rankedQuestions")
      .withIndex("by_run_question", (q) => q.eq("runId", args.runId).eq("questionIndex", args.questionIndex))
      .unique();

    if (!question) {
      return rejectRankedSubmission(ctx, {
        runId: run._id,
        userId: user._id,
        questionIndex: args.questionIndex,
        eventType: "submission_rejected",
        reason: "question_not_found",
        throwMessage: "Question not found.",
        requestReceivedAt: now,
      });
    }

    if (question.userAnswer !== null) {
      return rejectRankedSubmission(ctx, {
        runId: run._id,
        userId: user._id,
        questionIndex: args.questionIndex,
        eventType: "submission_rejected",
        reason: "duplicate_submission",
        throwMessage: "Question has already been answered.",
        requestReceivedAt: now,
      });
    }

    const optionIds = question.options.map((option) => option.id);
    if (!optionIds.includes(args.selectedAnswer)) {
      return rejectRankedSubmission(ctx, {
        runId: run._id,
        userId: user._id,
        questionIndex: args.questionIndex,
        eventType: "submission_rejected",
        reason: "invalid_option_id",
        throwMessage: "Invalid answer option submitted.",
        requestReceivedAt: now,
        metadata: {
          selectedAnswer: args.selectedAnswer,
          validOptionIds: optionIds,
        },
      });
    }

    const responseWindowStartAt = run.lastAnsweredAt ?? run.startedAt;
    const elapsedFromPreviousMs = Math.max(0, now - responseWindowStartAt);
    const elapsedFromStartMs = Math.max(0, now - run.startedAt);

    if (elapsedFromPreviousMs <= 0 || elapsedFromPreviousMs < securityPolicy.timingAnomaly.minResponseTimeMs) {
      return rejectRankedSubmission(ctx, {
        runId: run._id,
        userId: user._id,
        questionIndex: args.questionIndex,
        eventType: "timing_flagged",
        reason: "suspicious_timing_too_fast",
        throwMessage: "Submission rejected due to suspicious response timing.",
        requestReceivedAt: now,
        referenceTimestamp: responseWindowStartAt,
        elapsedMs: elapsedFromPreviousMs,
        metadata: {
          minResponseTimeMs: securityPolicy.timingAnomaly.minResponseTimeMs,
        },
      });
    }

    if (run.lastAnsweredAt !== undefined) {
      const intervalSinceLastSubmissionMs = now - run.lastAnsweredAt;
      if (intervalSinceLastSubmissionMs < securityPolicy.submissionRateLimit.minIntervalMs) {
        return rejectRankedSubmission(ctx, {
          runId: run._id,
          userId: user._id,
          questionIndex: args.questionIndex,
          eventType: "rate_limited",
          reason: "rate_limited_min_interval",
          throwMessage: "Submitting too quickly. Please wait a moment and try again.",
          requestReceivedAt: now,
          referenceTimestamp: run.lastAnsweredAt,
          elapsedMs: intervalSinceLastSubmissionMs,
          metadata: {
            minIntervalMs: securityPolicy.submissionRateLimit.minIntervalMs,
          },
        });
      }
    }

    const recentAuditRows = await ctx.db
      .query("rankedTimingAudit")
      .withIndex("by_run_createdAt", (q) => q.eq("runId", run._id))
      .order("desc")
      .take(500);

    const recentSubmissionCount = recentAuditRows.filter(
      (row) =>
        row.eventType === "submission_accepted" &&
        now - row.createdAt <= securityPolicy.submissionRateLimit.windowMs
    ).length;

    if (recentSubmissionCount >= securityPolicy.submissionRateLimit.maxPerWindow) {
      return rejectRankedSubmission(ctx, {
        runId: run._id,
        userId: user._id,
        questionIndex: args.questionIndex,
        eventType: "rate_limited",
        reason: "rate_limited_window",
        throwMessage: "Too many submissions in a short period. Please wait and try again.",
        requestReceivedAt: now,
        metadata: {
          windowMs: securityPolicy.submissionRateLimit.windowMs,
          maxPerWindow: securityPolicy.submissionRateLimit.maxPerWindow,
          recentSubmissionCount,
        },
      });
    }

    if (elapsedFromPreviousMs >= securityPolicy.timingAnomaly.slowResponseWarningMs) {
      await insertRankedTimingAudit(ctx, {
        runId: run._id,
        userId: user._id,
        questionIndex: args.questionIndex,
        eventType: "timing_flagged",
        requestReceivedAt: now,
        referenceTimestamp: responseWindowStartAt,
        elapsedMs: elapsedFromPreviousMs,
        reason: "slow_response_warning",
        metadata: {
          slowResponseWarningMs: securityPolicy.timingAnomaly.slowResponseWarningMs,
        },
      });
    }

    const isCorrect = args.selectedAnswer === question.correctAnswer;
    
    // Scoring logic:
    // Base Accuracy: 1000 points if correct
    // Speed Bonus: up to 3000 points if answered correctly in < 3000ms
    const basePoints = isCorrect ? 1000 : 0;
    const speedBonus = isCorrect && elapsedFromPreviousMs < 3000
      ? Math.max(0, Math.round(3000 - elapsedFromPreviousMs))
      : 0;

    const questionScore = basePoints + speedBonus;

    // Update the question response
    await ctx.db.patch(question._id, {
      userAnswer: args.selectedAnswer,
      serverReceivedAt: now,
      answeredAt: now,
      elapsedFromPreviousMs,
      elapsedFromStartMs,
      submissionSequenceValid: true,
      timingAnomalyCode:
        elapsedFromPreviousMs >= securityPolicy.timingAnomaly.slowResponseWarningMs
          ? "slow_response_warning"
          : undefined,
      responseTimeMs: elapsedFromPreviousMs,
      isCorrect: isCorrect,
      updatedAt: now,
    });

    // Update run aggregates
    const newCorrectCount = run.correctCount + (isCorrect ? 1 : 0);
    const newAccuracyPercent = Math.round((newCorrectCount / run.flagCount) * 100);
    const newScore = run.score + questionScore;
    const newPointsFromTime = run.pointsFromTime + speedBonus;
    const newPointsFromAccuracy = run.pointsFromAccuracy + basePoints;

    await ctx.db.patch(run._id, {
      lastAnsweredAt: now,
      nextExpectedQuestionIndex: Math.max(
        run.nextExpectedQuestionIndex ?? 0,
        args.questionIndex + 1
      ),
      totalElapsedMs: elapsedFromStartMs,
      correctCount: newCorrectCount,
      accuracyPercent: newAccuracyPercent,
      score: newScore,
      pointsFromTime: newPointsFromTime,
      pointsFromAccuracy: newPointsFromAccuracy,
      updatedAt: now,
    });

    await insertRankedTimingAudit(ctx, {
      runId: run._id,
      userId: user._id,
      questionIndex: args.questionIndex,
      eventType: "submission_accepted",
      requestReceivedAt: now,
      referenceTimestamp: responseWindowStartAt,
      elapsedMs: elapsedFromPreviousMs,
    });

    return {
      isCorrect,
      scoreGained: questionScore,
      pointsFromTime: speedBonus,
      pointsFromAccuracy: basePoints,
      serverReceivedAt: now,
      responseTimeMs: elapsedFromPreviousMs,
    };
  },
});

export const completeRankedRun = mutation({
  args: {
    runId: v.id("rankedRuns"),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthenticatedUser(ctx, "Authentication required to complete ranked run.");
    const run = await ctx.db.get(args.runId);

    if (!run || run.userId !== user._id) {
      throw new Error("Ranked run not found or access denied.");
    }

    if (run.status !== "started") {
      throw new Error("Ranked run is not active.");
    }

    const now = Date.now();
    const runDurationMs = now - run.startedAt;

    // Fetch questions to evaluate unanswered or check anti-cheat anomalies
    const questions = await ctx.db
      .query("rankedQuestions")
      .withIndex("by_run", (q) => q.eq("runId", args.runId))
      .collect();

    // Fill in any unanswered questions as incorrect
    const correctCount = run.correctCount;
    for (const q of questions) {
      if (q.userAnswer === null) {
        await ctx.db.patch(q._id, {
          userAnswer: "none",
          answeredAt: now,
          responseTimeMs: 0,
          isCorrect: false,
          updatedAt: now,
        });
      }
    }

    // Recalculate accuracy based on finalized correct count
    const accuracyPercent = Math.round((correctCount / run.flagCount) * 100);

    // Anti-Cheat: Timing Check
    // If the average response time is suspiciously fast (< 350ms per question) OR 
    // any single response time is < 100ms, flag it.
    let antiCheatStatus: "clear" | "flagged" = "clear";
    let suspiciousReason = undefined;

    const avgResponseTimeMs = runDurationMs / run.flagCount;
    const hasSuspectFastAnswer = questions.some(
      (q) => q.responseTimeMs !== undefined && q.responseTimeMs > 0 && q.responseTimeMs < 100
    );

    if (avgResponseTimeMs < 350) {
      antiCheatStatus = "flagged";
      suspiciousReason = `Average response time too fast (${Math.round(avgResponseTimeMs)}ms / question)`;
    } else if (hasSuspectFastAnswer) {
      antiCheatStatus = "flagged";
      suspiciousReason = `Detected answer timing below minimum human threshold (< 100ms)`;
    }

    await ctx.db.patch(run._id, {
      status: "completed",
      completedAt: now,
      runDurationMs,
      accuracyPercent,
      antiCheatStatus,
      suspiciousReason,
      updatedAt: now,
    });

    // Record user activity log event
    await ctx.db.insert("userActivityEvents", {
      targetUserId: user._id,
      eventType: "ranked_run_completed",
      metadataJson: JSON.stringify({
        runId: run._id,
        score: run.score,
        accuracyPercent,
        durationMs: runDurationMs,
        antiCheatStatus,
      }),
      createdAt: now,
    });

    return {
      runId: run._id,
      status: "completed",
      score: run.score,
      accuracyPercent,
      runDurationMs,
      antiCheatStatus,
    };
  },
});

export const abandonRankedRun = mutation({
  args: {
    runId: v.id("rankedRuns"),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthenticatedUser(ctx, "Authentication required to abandon ranked run.");
    const run = await ctx.db.get(args.runId);

    if (!run || run.userId !== user._id) {
      throw new Error("Ranked run not found or access denied.");
    }

    if (run.status !== "started") {
      throw new Error("Ranked run is not active.");
    }

    const now = Date.now();

    await ctx.db.patch(run._id, {
      status: "abandoned",
      completedAt: now,
      updatedAt: now,
    });

    return {
      runId: run._id,
      status: "abandoned",
    };
  },
});
