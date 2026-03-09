import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { assertAdminUser } from "./exams/services/auth";

export { getExamStartContext, getAttemptHistory } from "./exams/handlers/start";
export { getExamGenerationSettings } from "./exams/handlers/settings";
export { getAdminExamOverviewStats } from "./exams/handlers/adminStats";
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
} from "./exams/handlers/results";
export { backfillImmutableResults } from "./exams/handlers/maintenance";
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
