import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { assertAdminUser } from "./exams/services/auth";

export { getExamStartContext, getAttemptHistory } from "./exams/handlers/start";
export {
  getExamGenerationSettings,
  getExamIntegrityThresholds,
} from "./exams/handlers/settings";
export {
  getAdminExamOverviewStats,
  getAdminExamActivityTimeline,
} from "./exams/handlers/adminStats";
export { getAdminRecentExamAttempts } from "./exams/handlers/admin_exams";
export { getAdminExamCadetSuggestions } from "./exams/handlers/admin_exam_cadet_suggestions";
export {
  getAttemptRuntimeProgress,
  getCurrentAttemptQuestion,
  getAttemptPreload,
  getAttemptById,
} from "./exams/handlers/runtime";
export { startOfficialExamAttempt } from "./exams/handlers/startMutation";
export { submitExamAnswer } from "./exams/handlers/submission";
export {
  getMyOfficialResult,
  getMyOfficialResultsHistory,
  getOfficialResultForAdminReview,
  getOfficialResultByCertificate,
  verifyOfficialResultIntegrity,
  setOfficialResultInvestigationNotes,
} from "./exams/handlers/results";
export {
  backfillImmutableResults,
  reanalyzeOfficialResultIntegrity,
} from "./exams/handlers/maintenance";
export { logExamClientEvent } from "./exams/handlers/clientEvents";

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

export const setExamIntegrityThresholds = mutation({
  args: {
    minAverageAnswerTimeMs: v.number(),
    maxConsecutiveSameAnswer: v.number(),
    minExpectedDurationRatioPercent: v.number(),
    minAnswerTimeStdDevMs: v.number(),
  },
  handler: async (ctx, args) => {
    const adminUser = await assertAdminUser(ctx);

    const minAverageAnswerTimeMs = Math.round(args.minAverageAnswerTimeMs);
    const maxConsecutiveSameAnswer = Math.round(args.maxConsecutiveSameAnswer);
    const minExpectedDurationRatioPercent = Math.round(args.minExpectedDurationRatioPercent);
    const minAnswerTimeStdDevMs = Math.round(args.minAnswerTimeStdDevMs);

    if (minAverageAnswerTimeMs < 100) {
      throw new Error("minAverageAnswerTimeMs must be at least 100.");
    }

    if (maxConsecutiveSameAnswer < 2) {
      throw new Error("maxConsecutiveSameAnswer must be at least 2.");
    }

    if (minExpectedDurationRatioPercent < 1 || minExpectedDurationRatioPercent > 100) {
      throw new Error("minExpectedDurationRatioPercent must be between 1 and 100.");
    }

    if (minAnswerTimeStdDevMs < 100) {
      throw new Error("minAnswerTimeStdDevMs must be at least 100.");
    }

    const now = Date.now();

    const existing = await ctx.db
      .query("examSettings")
      .withIndex("by_updatedAt")
      .order("desc")
      .first();

    const integrityThresholds = {
      minAverageAnswerTimeMs,
      maxConsecutiveSameAnswer,
      minExpectedDurationRatioPercent,
      minAnswerTimeStdDevMs,
    };

    if (existing) {
      await ctx.db.patch(existing._id, {
        integrityThresholds,
        updatedBy: adminUser._id,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("examSettings", {
        modeStrategy: "alternating",
        singleMode: undefined,
        integrityThresholds,
        updatedBy: adminUser._id,
        updatedAt: now,
        createdAt: now,
      });
    }

    return {
      integrityThresholds,
      updatedAt: now,
    };
  },
});
