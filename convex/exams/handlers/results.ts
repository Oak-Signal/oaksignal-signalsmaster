import { mutation } from "../../_generated/server";
import { v } from "convex/values";
import { canAccessResultRecord, getAuthenticatedUser } from "../services/auth";
import { insertExamResultAccessLog } from "../services/audit";
import { sha256Hex, stableStringify } from "../services/hash";
import {
  buildCanonicalOfficialResultPayload,
  buildPercentileRanking,
  mapOfficialResultRecord,
} from "../services/result_access";

const MAX_INVESTIGATION_NOTES_LENGTH = 2000;

function sanitizeInvestigationNotes(rawNotes: string): string {
  return rawNotes
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

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

export const setOfficialResultInvestigationNotes = mutation({
  args: {
    examResultId: v.id("examResults"),
    notes: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user || user.role !== "admin") {
      return null;
    }

    const result = await ctx.db.get(args.examResultId);
    if (!result) {
      return null;
    }

    const sanitizedNotes = sanitizeInvestigationNotes(args.notes);
    if (sanitizedNotes.length > MAX_INVESTIGATION_NOTES_LENGTH) {
      throw new Error(`Investigation notes must be ${MAX_INVESTIGATION_NOTES_LENGTH} characters or less.`);
    }

    const updatedAt = Date.now();

    await ctx.db.patch(result._id, {
      investigationNotes: {
        notes: sanitizedNotes,
        updatedAt,
        updatedBy: user._id,
      },
    });

    const updatedResult = await ctx.db.get(result._id);
    if (!updatedResult) {
      return null;
    }

    await insertExamResultAccessLog(ctx, {
      result: updatedResult,
      actorUser: user,
      accessType: "result_read",
      metadata: {
        endpoint: "setOfficialResultInvestigationNotes",
        requestedResultId: args.examResultId,
        notesLength: sanitizedNotes.length,
      },
    });

    return {
      ...mapOfficialResultRecord(updatedResult),
      percentileRanking: await buildPercentileRanking(ctx, updatedResult),
    };
  },
});
