import { mutation } from "../../_generated/server";
import { v } from "convex/values";
import { buildQuestionChecksum } from "../../lib/exam_checksum";
import { validateExamSessionToken } from "../../lib/exam_session_token";
import {
  getAuthenticatedUser,
  getOwnedAttempt,
} from "../services/auth";
import {
  getOfficialExamIdleTimeoutMs,
  getOfficialExamSubmissionRateLimitConfig,
  getOfficialExamTimingAnomalyConfig,
} from "../services/config";
import {
  insertExamAuditLog,
  rejectExamSubmission,
} from "../services/audit";
import {
  getCurrentQuestionIndex,
  roundToTwoDecimals,
} from "../services/time";
import { sha256Hex, stableStringify } from "../services/hash";
import { getAttemptQuestions } from "../services/query_helpers";
import {
  buildCertificateNumber,
  buildCompletedExamStats,
  buildQuestionBreakdownFromAttempt,
} from "../services/result_builder";

export const submitExamAnswer = mutation({
  args: {
    examAttemptId: v.id("examAttempts"),
    questionIndex: v.number(),
    selectedAnswer: v.string(),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user) {
      throw new Error("Must be authenticated to submit official exam answers.");
    }

    const attempt = await getOwnedAttempt(ctx, user._id, args.examAttemptId);
    if (!attempt) {
      return rejectExamSubmission(ctx, {
        examAttemptId: args.examAttemptId,
        userId: user._id,
        questionIndex: args.questionIndex,
        reason: "attempt_not_found_or_access_denied",
        auditMessage: "Rejected submission because exam attempt was not found or access was denied.",
        throwMessage: "Exam attempt not found or access denied.",
      });
    }

    if (attempt.immutableAt !== undefined) {
      return rejectExamSubmission(ctx, {
        examAttemptId: args.examAttemptId,
        userId: user._id,
        questionIndex: args.questionIndex,
        reason: "attempt_immutable",
        eventType: "immutable_write_blocked",
        auditMessage: "Blocked write attempt against immutable exam attempt.",
        throwMessage: "This exam attempt has been finalized and is immutable.",
        metadata: {
          immutableAt: attempt.immutableAt,
          attemptStatus: attempt.status,
        },
      });
    }

    if (attempt.status !== "started") {
      return rejectExamSubmission(ctx, {
        examAttemptId: args.examAttemptId,
        userId: user._id,
        questionIndex: args.questionIndex,
        reason: "attempt_not_active",
        auditMessage: "Rejected submission because exam attempt is no longer active.",
        throwMessage: "Exam attempt is no longer active.",
        metadata: {
          attemptStatus: attempt.status,
        },
      });
    }

    const idleTimeoutMs = getOfficialExamIdleTimeoutMs();

    if (attempt.sessionTokenHash && attempt.sessionIssuedAt && attempt.sessionExpiresAt) {
      if (!args.sessionToken) {
        return rejectExamSubmission(ctx, {
          examAttemptId: args.examAttemptId,
          userId: user._id,
          questionIndex: args.questionIndex,
          reason: "missing_session_token",
          eventType: "session_token_rejected",
          auditMessage: "Rejected submission because session token was missing.",
          throwMessage: "Session validation failed. Please refresh the exam session.",
        });
      }

      const tokenValidation = await validateExamSessionToken({
        token: args.sessionToken,
        examAttemptId: args.examAttemptId,
        userId: user._id,
        issuedAt: attempt.sessionIssuedAt,
        expiresAt: attempt.sessionExpiresAt,
        expectedHash: attempt.sessionTokenHash,
      });

      if (!tokenValidation.valid) {
        return rejectExamSubmission(ctx, {
          examAttemptId: args.examAttemptId,
          userId: user._id,
          questionIndex: args.questionIndex,
          reason: tokenValidation.reason ?? "unknown",
          eventType: "session_token_rejected",
          auditMessage: "Rejected submission due to invalid session token.",
          throwMessage: "Session validation failed. Please refresh the exam session.",
        });
      }

      await insertExamAuditLog(ctx, {
        examAttemptId: args.examAttemptId,
        userId: user._id,
        eventType: "session_token_validated",
        message: "Validated session token for submission.",
        metadata: {
          questionIndex: args.questionIndex,
        },
      });
    }

    const questions = await getAttemptQuestions(ctx, args.examAttemptId);
    const requestReceivedAt = Date.now();
    const submissionRateLimit = getOfficialExamSubmissionRateLimitConfig();
    const timingAnomaly = getOfficialExamTimingAnomalyConfig();

    const answeredTimestamps = questions
      .map((question) => question.answeredAt ?? null)
      .filter((answeredAt): answeredAt is number => answeredAt !== null)
      .sort((a, b) => b - a);

    const mostRecentAnsweredAt = answeredTimestamps[0] ?? null;
    const responseWindowStartAt = mostRecentAnsweredAt ?? attempt.startedAt;
    const responseTimeMs = requestReceivedAt - responseWindowStartAt;

    if (responseTimeMs < timingAnomaly.minResponseTimeMs) {
      return rejectExamSubmission(ctx, {
        examAttemptId: args.examAttemptId,
        userId: user._id,
        questionIndex: args.questionIndex,
        reason: "suspicious_timing_too_fast",
        auditMessage: "Rejected submission due to suspiciously fast response timing.",
        throwMessage: "Submission rejected due to suspicious response timing.",
        metadata: {
          responseTimeMs,
          minResponseTimeMs: timingAnomaly.minResponseTimeMs,
          responseWindowStartAt,
        },
      });
    }

    if (responseTimeMs >= timingAnomaly.slowResponseWarningMs) {
      await insertExamAuditLog(ctx, {
        examAttemptId: args.examAttemptId,
        userId: user._id,
        eventType: "idle_warning_shown",
        message: "Detected unusually slow response timing for exam submission.",
        metadata: {
          questionIndex: args.questionIndex,
          responseTimeMs,
          slowResponseWarningMs: timingAnomaly.slowResponseWarningMs,
          responseWindowStartAt,
        },
      });
    }

    if (mostRecentAnsweredAt !== null) {
      const intervalSinceLastSubmissionMs = requestReceivedAt - mostRecentAnsweredAt;
      if (intervalSinceLastSubmissionMs < submissionRateLimit.minIntervalMs) {
        return rejectExamSubmission(ctx, {
          examAttemptId: args.examAttemptId,
          userId: user._id,
          questionIndex: args.questionIndex,
          reason: "rate_limited_min_interval",
          auditMessage: "Rejected submission due to minimum interval rate limit.",
          throwMessage: "Submitting too quickly. Please wait a moment and try again.",
          metadata: {
            intervalSinceLastSubmissionMs,
            minIntervalMs: submissionRateLimit.minIntervalMs,
            lastAnsweredAt: mostRecentAnsweredAt,
          },
        });
      }
    }

    const recentSubmissionCount = answeredTimestamps.filter(
      (answeredAt) => requestReceivedAt - answeredAt <= submissionRateLimit.windowMs
    ).length;

    if (recentSubmissionCount >= submissionRateLimit.maxPerWindow) {
      return rejectExamSubmission(ctx, {
        examAttemptId: args.examAttemptId,
        userId: user._id,
        questionIndex: args.questionIndex,
        reason: "rate_limited_window",
        auditMessage: "Rejected submission due to rolling-window rate limit.",
        throwMessage: "Too many submissions in a short period. Please wait and try again.",
        metadata: {
          recentSubmissionCount,
          windowMs: submissionRateLimit.windowMs,
          maxPerWindow: submissionRateLimit.maxPerWindow,
        },
      });
    }

    if (idleTimeoutMs !== null) {
      const lastActivityAt = mostRecentAnsweredAt ?? attempt.startedAt;
      const idleDurationMs = requestReceivedAt - lastActivityAt;
      if (idleDurationMs >= idleTimeoutMs) {
        await ctx.db.patch(attempt._id, {
          status: "abandoned",
          completedAt: requestReceivedAt,
          immutableAt: requestReceivedAt,
          updatedAt: requestReceivedAt,
        });

        await insertExamAuditLog(ctx, {
          examAttemptId: args.examAttemptId,
          userId: user._id,
          eventType: "idle_timeout_triggered",
          message: "Exam attempt ended automatically due to inactivity timeout.",
          metadata: {
            idleTimeoutMs,
            idleDurationMs,
            lastActivityAt,
            questionIndex: args.questionIndex,
          },
        });

        throw new Error("Exam attempt ended due to inactivity. Return to Exam Start.");
      }
    }

    await insertExamAuditLog(ctx, {
      examAttemptId: args.examAttemptId,
      userId: user._id,
      eventType: "submission_received",
      message: "Official exam answer submission received.",
      metadata: {
        questionIndex: args.questionIndex,
      },
    });

    const expectedQuestionIndex = getCurrentQuestionIndex(questions);
    if (expectedQuestionIndex === null) {
      return rejectExamSubmission(ctx, {
        examAttemptId: args.examAttemptId,
        userId: user._id,
        questionIndex: args.questionIndex,
        reason: "attempt_already_completed",
        auditMessage: "Rejected submission because exam has already been completed.",
        throwMessage: "Exam has already been completed.",
      });
    }

    if (args.questionIndex !== expectedQuestionIndex) {
      return rejectExamSubmission(ctx, {
        examAttemptId: args.examAttemptId,
        userId: user._id,
        questionIndex: args.questionIndex,
        reason: "out_of_order_submission",
        auditMessage: "Rejected out-of-order question submission.",
        throwMessage: `Question index mismatch. Expected ${expectedQuestionIndex}, got ${args.questionIndex}.`,
        metadata: {
          expectedQuestionIndex,
          receivedQuestionIndex: args.questionIndex,
        },
      });
    }

    const question = await ctx.db
      .query("examQuestions")
      .withIndex("by_attempt_question", (q) =>
        q.eq("examAttemptId", args.examAttemptId).eq("questionIndex", args.questionIndex)
      )
      .first();

    if (!question) {
      return rejectExamSubmission(ctx, {
        examAttemptId: args.examAttemptId,
        userId: user._id,
        questionIndex: args.questionIndex,
        reason: "question_not_found",
        auditMessage: "Rejected submission because exam question was not found.",
        throwMessage: "Exam question not found.",
      });
    }

    if (question.userAnswer !== null) {
      return rejectExamSubmission(ctx, {
        examAttemptId: args.examAttemptId,
        userId: user._id,
        questionIndex: args.questionIndex,
        reason: "duplicate_submission",
        auditMessage: "Rejected duplicate submission for previously answered question.",
        throwMessage: "This question has already been answered.",
      });
    }

    const optionIds = question.options.map((option) => option.id);
    if (!optionIds.includes(args.selectedAnswer)) {
      return rejectExamSubmission(ctx, {
        examAttemptId: args.examAttemptId,
        userId: user._id,
        questionIndex: args.questionIndex,
        reason: "invalid_option_id",
        auditMessage: "Rejected submission with invalid option id.",
        throwMessage: "Invalid answer option submitted.",
        metadata: {
          selectedAnswer: args.selectedAnswer,
          validOptionIds: optionIds,
        },
      });
    }

    const expectedChecksum = buildQuestionChecksum({
      examAttemptId: "pending",
      questionIndex: question.questionIndex,
      flagKey: question.flagKey,
      mode: question.mode,
      options: question.options,
      correctAnswer: question.correctAnswer,
    });

    if (question.checksum !== expectedChecksum) {
      return rejectExamSubmission(ctx, {
        examAttemptId: args.examAttemptId,
        userId: user._id,
        questionIndex: args.questionIndex,
        reason: "question_checksum_mismatch",
        auditMessage: "Rejected submission due to question checksum mismatch.",
        throwMessage: "Exam question integrity check failed.",
        metadata: {
          expectedChecksum,
          receivedChecksum: question.checksum,
        },
      });
    }

    const submittedAt = Date.now();
    const isCorrect = args.selectedAnswer === question.correctAnswer;

    await ctx.db.patch(question._id, {
      userAnswer: args.selectedAnswer,
      answeredAt: submittedAt,
      isCorrect,
      updatedAt: submittedAt,
    });

    const updatedQuestions = await getAttemptQuestions(ctx, args.examAttemptId);
    const totalQuestions = updatedQuestions.length;
    const answeredCount = updatedQuestions.filter((item) => item.userAnswer !== null).length;
    const correctCount = updatedQuestions.filter((item) => item.isCorrect === true).length;
    const nextQuestionIndex = getCurrentQuestionIndex(updatedQuestions);
    const isExamComplete = nextQuestionIndex === null;

    if (isExamComplete) {
      const scorePercent = totalQuestions > 0
        ? roundToTwoDecimals((correctCount / totalQuestions) * 100)
        : 0;
      const passed = scorePercent >= attempt.policySnapshot.passThresholdPercent;
      const { modeStats, categoryStats } = buildCompletedExamStats(updatedQuestions, attempt);

      const sortedQuestions = [...updatedQuestions].sort((a, b) => a.questionIndex - b.questionIndex);
      const questionBreakdown = await buildQuestionBreakdownFromAttempt(ctx, {
        attempt,
        sortedQuestions,
      });

      const examModesUsed = [...new Set(sortedQuestions.map((item) => item.mode))];
      const generationSnapshot = attempt.generationSnapshot;
      const roleAtExam: "cadet" | "admin" = user.role === "admin" ? "admin" : "cadet";
      const certificateNumber = buildCertificateNumber({
        completedAt: submittedAt,
        attemptNumber: attempt.attemptNumber,
        examAttemptId: String(attempt._id),
      });

      const canonicalResultPayload = {
        examAttemptId: attempt._id,
        userId: user._id,
        immutable: true,
        immutableAt: submittedAt,
        certificateNumber,
        resultVersion: 1,
        userSnapshot: {
          userId: user._id,
          fullName: user.name?.trim() || user.email,
          roleAtExam,
        },
        attemptNumber: attempt.attemptNumber,
        startedAt: attempt.startedAt,
        completedAt: submittedAt,
        totalQuestions,
        totalCorrect: correctCount,
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

      const canonicalJson = stableStringify(canonicalResultPayload);
      const recordChecksum = await sha256Hex(canonicalJson);
      const signatureAlgorithm = "sha256";
      const signature = recordChecksum;

      let examResultId = attempt.examResultId;
      if (examResultId) {
        return rejectExamSubmission(ctx, {
          examAttemptId: args.examAttemptId,
          userId: user._id,
          questionIndex: args.questionIndex,
          reason: "result_record_already_exists",
          eventType: "immutable_write_blocked",
          auditMessage: "Blocked duplicate immutable result creation attempt.",
          throwMessage: "This exam attempt has already been finalized.",
          metadata: {
            examResultId,
          },
        });
      }

      if (!examResultId) {
        examResultId = await ctx.db.insert("examResults", {
          ...canonicalResultPayload,
          recordChecksum,
          signatureAlgorithm,
          signature,
          createdAt: submittedAt,
        });
      }

      await ctx.db.patch(attempt._id, {
        examResultId,
        status: "completed",
        completedAt: submittedAt,
        immutableAt: submittedAt,
        result: {
          totalQuestions,
          correctCount,
          scorePercent,
          passed,
          modeStats,
          categoryStats,
        },
        updatedAt: submittedAt,
      });
    } else {
      await ctx.db.patch(attempt._id, {
        updatedAt: submittedAt,
      });
    }

    await insertExamAuditLog(ctx, {
      examAttemptId: args.examAttemptId,
      userId: user._id,
      eventType: "submission_validated",
      message: "Official exam answer accepted and validated.",
      metadata: {
        questionIndex: args.questionIndex,
        isCorrect,
      },
    });

    return {
      questionIndex: args.questionIndex,
      nextQuestionIndex,
      answeredCount,
      totalQuestions,
      isExamComplete,
    };
  },
});
