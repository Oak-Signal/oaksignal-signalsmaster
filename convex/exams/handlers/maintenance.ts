import { mutation } from "../../_generated/server";
import { v } from "convex/values";
import { assertAdminUser } from "../services/auth";
import { insertExamAuditLog } from "../services/audit";
import { stableStringify, sha256Hex } from "../services/hash";
import { roundToTwoDecimals } from "../services/time";
import {
  getAttemptQuestions,
  resolveExamIntegrityThresholds,
} from "../services/query_helpers";
import {
  buildCertificateNumber,
  buildCompletedExamStats,
  buildQuestionBreakdownFromAttempt,
} from "../services/result_builder";
import { OFFICIAL_EXAM_ESTIMATED_SECONDS_PER_QUESTION } from "../../lib/exam_policy";
import { evaluateOfficialExamIntegrity } from "../services/integrity_detection";
import { buildCanonicalOfficialResultPayload } from "../services/result_access";

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
      const scorePercent = totalQuestions > 0 ? roundToTwoDecimals((totalCorrect / totalQuestions) * 100) : 0;
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

export const reanalyzeOfficialResultIntegrity = mutation({
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
    const thresholds = await resolveExamIntegrityThresholds(ctx);
    const results = await ctx.db
      .query("examResults")
      .withIndex("by_completedAt")
      .order("desc")
      .take(limit);

    const summary = {
      scanned: results.length,
      updated: 0,
      skippedMissingAttempt: 0,
      dryRun,
    };

    for (const result of results) {
      const attempt = await ctx.db.get(result.examAttemptId);
      if (!attempt) {
        summary.skippedMissingAttempt += 1;
        continue;
      }

      const expectedDurationMs = Math.max(
        0,
        result.totalQuestions * OFFICIAL_EXAM_ESTIMATED_SECONDS_PER_QUESTION * 1000
      );

      const securityEvents = await ctx.db
        .query("examAuditLogs")
        .withIndex("by_attempt_createdAt", (q) => q.eq("examAttemptId", attempt._id))
        .collect();

      const integrityAssessment = evaluateOfficialExamIntegrity({
        startedAt: result.startedAt,
        completedAt: result.completedAt,
        expectedDurationMs,
        questionBreakdown: result.questionBreakdown.map((question) => ({
          selectedAnswer: question.selectedAnswer,
          responseTimeMs: question.responseTimeMs,
        })),
        thresholds,
        attempt,
        auditEvents: securityEvents.map((event) => event.eventType),
      });

      if (!dryRun) {
        await ctx.db.patch(result._id, {
          hasIntegrityFlags: integrityAssessment.hasIntegrityFlags,
          integrityScore: integrityAssessment.integrityScore,
          integritySeverity: integrityAssessment.integritySeverity,
          integritySignals: integrityAssessment.integritySignals,
        });

        const updatedResult = await ctx.db.get(result._id);
        if (!updatedResult) {
          continue;
        }

        const canonicalPayload = buildCanonicalOfficialResultPayload(updatedResult);
        const canonicalJson = stableStringify(canonicalPayload);
        const recordChecksum = await sha256Hex(canonicalJson);

        await ctx.db.patch(result._id, {
          recordChecksum,
          signatureAlgorithm: "sha256",
          signature: recordChecksum,
        });

        await insertExamAuditLog(ctx, {
          examAttemptId: attempt._id,
          userId: adminUser._id,
          eventType: "result_backfilled",
          message: "Reanalyzed official result integrity signals.",
          metadata: {
            source: "reanalyzeOfficialResultIntegrity",
            examResultId: result._id,
            hasIntegrityFlags: integrityAssessment.hasIntegrityFlags,
            integrityScore: integrityAssessment.integrityScore,
          },
        });
      }

      summary.updated += 1;
    }

    return summary;
  },
});
