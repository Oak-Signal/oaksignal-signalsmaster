import { MutationCtx, query, mutation } from "../../_generated/server";
import { v } from "convex/values";
import { requireAuthenticatedUser } from "../../lib/auth";
import { getResolvedSecurityPolicyConfig } from "../services/runtime";
import { Doc, Id } from "../../_generated/dataModel";
import { issueRankedResultToken } from "../services/result_signature";
import { computeRankedRunRankChange } from "../services/leaderboard";
import { sha256Hex, stableStringify } from "../../exams/services/hash";

function computeStdDeviation(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function getLongestConsecutiveSameAnswer(answers: string[]): number {
  if (answers.length === 0) {
    return 0;
  }

  let longest = 1;
  let current = 1;

  for (let index = 1; index < answers.length; index += 1) {
    if (answers[index] === answers[index - 1]) {
      current += 1;
      longest = Math.max(longest, current);
    } else {
      current = 1;
    }
  }

  return longest;
}

function parseSuspiciousFlags(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
}

// Per-rule severity weights, modeled on the exam integrity model's severity tiers
// (convex/exams/services/integrity_detection.ts) so ranked soft-anomaly flags carry the
// same admin-review-ready shape (FR-011a). Weight scale is additive; see classifySuspiciousFlags.
const SUSPICIOUS_FLAG_RULE_WEIGHTS: Record<string, number> = {
  avg_response_too_fast: 3,
  fast_answer_detected: 2,
  low_timing_variance: 2,
  consecutive_same_answer: 2,
  replay_fingerprint_match: 4,
};

function classifySuspiciousFlags(flags: string[]): {
  severity: "low" | "medium" | "high" | undefined;
  integrityScore: number;
} {
  const integrityScore = flags.reduce((total, flag) => {
    const ruleId = flag.split(":")[0];
    return total + (SUSPICIOUS_FLAG_RULE_WEIGHTS[ruleId] ?? 1);
  }, 0);

  let severity: "low" | "medium" | "high" | undefined;
  if (integrityScore >= 4) {
    severity = "high";
  } else if (integrityScore >= 2) {
    severity = "medium";
  } else if (integrityScore >= 1) {
    severity = "low";
  }

  return { severity, integrityScore };
}

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
      | "replay_flagged"
      | "run_voided";
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

/**
 * Voids an incomplete ranked run (explicit abandon, or auto-voided because it went stale
 * while stuck in "started" status) with no score recorded, per FR-008a. Voided runs are
 * never "completed" so they are already excluded from leaderboard standings; this also
 * resets the score/accuracy aggregates so a voided run never carries a stale, non-authoritative
 * score forward.
 */
export async function voidRankedRun(
  ctx: MutationCtx,
  input: {
    run: Doc<"rankedRuns">;
    userId: Id<"users">;
    now: number;
    reason: string;
  }
): Promise<void> {
  await ctx.db.patch(input.run._id, {
    status: "abandoned",
    completedAt: input.now,
    updatedAt: input.now,
    score: 0,
    pointsFromAccuracy: 0,
    pointsFromTime: 0,
    correctCount: 0,
    accuracyPercent: 0,
  });

  await insertRankedTimingAudit(ctx, {
    runId: input.run._id,
    userId: input.userId,
    eventType: "run_voided",
    requestReceivedAt: input.now,
    reason: input.reason,
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
      finalizedAt: run.finalizedAt ?? null,
      immutableAt: run.immutableAt ?? null,
      runDurationMs: run.runDurationMs ?? null,
      totalElapsedMs: run.totalElapsedMs ?? null,
      flagCount: run.flagCount,
      correctCount: run.correctCount,
      accuracyPercent: run.accuracyPercent,
      score: run.score,
      pointsFromTime: run.pointsFromTime,
      pointsFromAccuracy: run.pointsFromAccuracy,
      signatureVersion: run.signatureVersion ?? null,
      signatureIssuedAt: run.signatureIssuedAt ?? null,
      hasSignedResult: Boolean(run.resultSignatureHash && run.resultTokenHash),
      runChecksum: run.runChecksum ?? null,
      replayFingerprintHash: run.replayFingerprintHash ?? null,
      suspiciousFlags: parseSuspiciousFlags(run.suspiciousFlagsJson),
      antiCheatStatus: run.antiCheatStatus,
      reviewStatus: run.reviewStatus,
      suspiciousReason: run.suspiciousReason ?? null,
      suspiciousSeverity: run.suspiciousSeverity ?? null,
      integrityScore: run.integrityScore ?? null,
    };
  },
});

/**
 * Derives the rank-progression change caused by a specific finalized ranked run (US5/FR-018)
 * by comparing the season leaderboard with vs. without that run. Returns null while the run
 * is not yet completed/eligible so results UI can render a neutral state until data is ready.
 */
export const getRankedRunRankChange = query({
  args: {
    runId: v.id("rankedRuns"),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthenticatedUser(
      ctx,
      "Authentication required to fetch ranked rank change."
    );
    const run = await ctx.db.get(args.runId);

    if (!run || run.userId !== user._id) {
      return null;
    }

    return computeRankedRunRankChange(ctx, run);
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

    // Update run aggregates. The in-run "score" shown while a run is still "started" is a
    // provisional read of the SAME authoritative formula used at finalization
    // (accuracyPercent x 1000 - elapsedSeconds / 2), derived only from server-stored facts
    // (accepted answers so far, elapsed time so far) -- never a separately-accumulated
    // per-question value that could diverge from the final score (FR-005/FR-007/FR-008).
    const newCorrectCount = run.correctCount + (isCorrect ? 1 : 0);
    const newAccuracyPercent = Math.round((newCorrectCount / run.flagCount) * 100);
    const provisionalPointsFromAccuracy = newAccuracyPercent * 1000;
    const provisionalScore = Math.round(provisionalPointsFromAccuracy - elapsedFromStartMs / 2000);
    const provisionalPointsFromTime = provisionalScore - provisionalPointsFromAccuracy;

    await ctx.db.patch(run._id, {
      lastAnsweredAt: now,
      nextExpectedQuestionIndex: Math.max(
        run.nextExpectedQuestionIndex ?? 0,
        args.questionIndex + 1
      ),
      totalElapsedMs: elapsedFromStartMs,
      correctCount: newCorrectCount,
      accuracyPercent: newAccuracyPercent,
      score: provisionalScore,
      pointsFromTime: provisionalPointsFromTime,
      pointsFromAccuracy: provisionalPointsFromAccuracy,
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
      score: provisionalScore,
      pointsFromAccuracy: provisionalPointsFromAccuracy,
      pointsFromTime: provisionalPointsFromTime,
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
    const securityPolicy = getResolvedSecurityPolicyConfig();

    // Fetch questions and enforce strict completion prerequisites.
    const questions = await ctx.db
      .query("rankedQuestions")
      .withIndex("by_run", (q) => q.eq("runId", args.runId))
      .collect();

    const unansweredCount = questions.filter((question) => question.userAnswer === null).length;
    if (unansweredCount > 0) {
      await insertRankedTimingAudit(ctx, {
        runId: run._id,
        userId: user._id,
        eventType: "submission_rejected",
        requestReceivedAt: now,
        reason: "incomplete_run_submission",
        metadata: {
          unansweredCount,
          flagCount: run.flagCount,
        },
      });

      throw new Error("All questions must be answered before final scoring.");
    }

    const completedAt = run.lastAnsweredAt ?? now;
    const runDurationMs = Math.max(0, completedAt - run.startedAt);
    const sortedQuestions = [...questions].sort((left, right) => left.questionIndex - right.questionIndex);

    const correctCount = sortedQuestions.filter((question) => question.isCorrect === true).length;
    // Whole-percent rounding, unified with the same rounding used for the in-run provisional
    // accuracy in `submitRankedAnswer` (FR-005/FR-006, T014) -- the two paths must never diverge.
    const accuracyPercent = run.flagCount > 0 ? Math.round((correctCount / run.flagCount) * 100) : 0;

    // Single round of the whole authoritative formula (FR-005), not a sum of independently
    // rounded components -- pointsFromTime is then derived as the remainder so the displayed
    // breakdown always sums exactly to the final score.
    const pointsFromAccuracy = accuracyPercent * 1000;
    const finalScore = Math.round(pointsFromAccuracy - runDurationMs / 2000);
    const pointsFromTime = finalScore - pointsFromAccuracy;

    if (!securityPolicy.resultSigning.enabled) {
      throw new Error("Ranked result signing is not configured. Contact an administrator.");
    }

    const signedResult = await issueRankedResultToken({
      runId: run._id,
      userId: user._id,
      score: finalScore,
      timestamp: completedAt,
    });

    const answerSequence = sortedQuestions.map((question) => question.userAnswer ?? "<null>");
    const responseTimes = sortedQuestions
      .map((question) => question.responseTimeMs ?? 0)
      .filter((value) => value > 0);
    const responseTimeStdDevMs = computeStdDeviation(responseTimes);
    const longestConsecutiveSameAnswer = getLongestConsecutiveSameAnswer(answerSequence);

    const runChecksum = await sha256Hex(
      stableStringify({
        runId: run._id,
        userId: run.userId,
        seasonId: run.seasonId,
        startedAt: run.startedAt,
        completedAt,
        questions: sortedQuestions.map((question) => ({
          questionIndex: question.questionIndex,
          flagKey: question.flagKey,
          userAnswer: question.userAnswer,
          isCorrect: question.isCorrect ?? false,
          responseTimeMs: question.responseTimeMs ?? null,
          answeredAt: question.answeredAt ?? null,
          serverReceivedAt: question.serverReceivedAt ?? null,
        })),
      })
    );

    const replayFingerprintHash = await sha256Hex(
      stableStringify({
        userId: run.userId,
        seasonId: run.seasonId,
        flagCount: run.flagCount,
        answerSequence,
        responseTimes,
      })
    );

    const seasonRunsForReplay = await ctx.db
      .query("rankedRuns")
      .withIndex("by_season_user_completedAt", (q) =>
        q.eq("seasonId", run.seasonId).eq("userId", run.userId)
      )
      .order("desc")
      .take(50);

    const replayMatch = seasonRunsForReplay.find(
      (candidate) =>
        candidate._id !== run._id &&
        candidate.status === "completed" &&
        candidate.replayFingerprintHash !== undefined &&
        candidate.replayFingerprintHash === replayFingerprintHash
    );

    // Anti-cheat timing checks are computed from server-side timings only.
    let antiCheatStatus: "clear" | "flagged" = "clear";
    let suspiciousReason: string | undefined = undefined;
    const suspiciousFlags: string[] = [];

    const avgResponseTimeMs = run.flagCount > 0 ? runDurationMs / run.flagCount : 0;
    const hasSuspectFastAnswer = sortedQuestions.some(
      (q) => q.responseTimeMs !== undefined && q.responseTimeMs > 0 && q.responseTimeMs < securityPolicy.timingAnomaly.minResponseTimeMs
    );

    if (avgResponseTimeMs < securityPolicy.timingAnomaly.minAverageAnswerTimeMs) {
      suspiciousFlags.push(`avg_response_too_fast:${Math.round(avgResponseTimeMs)}ms`);
    } else if (hasSuspectFastAnswer) {
      suspiciousFlags.push(`fast_answer_detected:<${securityPolicy.timingAnomaly.minResponseTimeMs}ms`);
    }

    if (
      responseTimes.length > 1 &&
      responseTimeStdDevMs < securityPolicy.timingAnomaly.minAnswerTimeStdDevMs
    ) {
      suspiciousFlags.push(
        `low_timing_variance:${Math.round(responseTimeStdDevMs)}ms(<${securityPolicy.timingAnomaly.minAnswerTimeStdDevMs}ms)`
      );
    }

    if (
      longestConsecutiveSameAnswer >= securityPolicy.timingAnomaly.maxConsecutiveSameAnswer
    ) {
      suspiciousFlags.push(
        `consecutive_same_answer:${longestConsecutiveSameAnswer}(>=${securityPolicy.timingAnomaly.maxConsecutiveSameAnswer})`
      );
    }

    if (replayMatch) {
      suspiciousFlags.push(`replay_fingerprint_match:${replayMatch._id}`);
      await insertRankedTimingAudit(ctx, {
        runId: run._id,
        userId: user._id,
        eventType: "replay_flagged",
        requestReceivedAt: now,
        reason: "replay_fingerprint_match",
        metadata: {
          matchedRunId: replayMatch._id,
        },
      });
    }

    const { severity: suspiciousSeverity, integrityScore } = classifySuspiciousFlags(suspiciousFlags);

    if (suspiciousFlags.length > 0) {
      antiCheatStatus = "flagged";
      suspiciousReason = suspiciousFlags[0];
      await insertRankedTimingAudit(ctx, {
        runId: run._id,
        userId: user._id,
        eventType: "timing_flagged",
        requestReceivedAt: now,
        reason: "finalization_outlier_detection",
        metadata: {
          suspiciousFlags,
          suspiciousSeverity,
          integrityScore,
          responseTimeStdDevMs: Math.round(responseTimeStdDevMs * 100) / 100,
          longestConsecutiveSameAnswer,
        },
      });
    }

    await ctx.db.patch(run._id, {
      status: "completed",
      completedAt,
      finalizedAt: now,
      immutableAt: now,
      runDurationMs,
      totalElapsedMs: runDurationMs,
      nextExpectedQuestionIndex: run.flagCount,
      correctCount,
      accuracyPercent,
      score: finalScore,
      pointsFromTime,
      pointsFromAccuracy,
      resultTokenHash: signedResult.tokenHash,
      resultSignatureHash: signedResult.signatureHash,
      resultSalt: signedResult.salt,
      signatureVersion: signedResult.version,
      signatureIssuedAt: signedResult.issuedAt,
      runChecksum,
      replayFingerprintHash,
      suspiciousFlagsJson: suspiciousFlags.length > 0 ? JSON.stringify(suspiciousFlags) : undefined,
      antiCheatStatus,
      suspiciousReason,
      suspiciousSeverity,
      integrityScore: suspiciousFlags.length > 0 ? integrityScore : undefined,
      updatedAt: now,
    });

    await insertRankedTimingAudit(ctx, {
      runId: run._id,
      userId: user._id,
      eventType: "run_finalized",
      requestReceivedAt: now,
      referenceTimestamp: completedAt,
      elapsedMs: runDurationMs,
      metadata: {
        score: finalScore,
        pointsFromAccuracy,
        pointsFromTime,
        accuracyPercent,
        correctCount,
        flagCount: run.flagCount,
        antiCheatStatus,
        runChecksum,
        replayFingerprintHash,
        suspiciousFlags,
        suspiciousSeverity,
        integrityScore,
        responseTimeStdDevMs: Math.round(responseTimeStdDevMs * 100) / 100,
        longestConsecutiveSameAnswer,
        signatureVersion: signedResult.version,
        signatureIssuedAt: signedResult.issuedAt,
      },
    });

    // Record user activity log event
    await ctx.db.insert("userActivityEvents", {
      targetUserId: user._id,
      eventType: "ranked_run_completed",
      metadataJson: JSON.stringify({
        runId: run._id,
        score: finalScore,
        accuracyPercent,
        durationMs: runDurationMs,
        antiCheatStatus,
        signatureVersion: signedResult.version,
      }),
      createdAt: now,
    });

    return {
      runId: run._id,
      status: "completed",
      score: finalScore,
      accuracyPercent,
      runDurationMs,
      antiCheatStatus,
      resultToken: signedResult.token,
      signatureVersion: signedResult.version,
      signatureIssuedAt: signedResult.issuedAt,
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

    await voidRankedRun(ctx, {
      run,
      userId: user._id,
      now,
      reason: "user_abandoned_run",
    });

    return {
      runId: run._id,
      status: "abandoned",
    };
  },
});
