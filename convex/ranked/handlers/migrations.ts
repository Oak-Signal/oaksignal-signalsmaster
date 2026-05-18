import { mutation } from "../../_generated/server";
import { v } from "convex/values";

import { requireAdminUser } from "../../lib/auth";
import {
  RANKED_DEFAULT_CONFIG_KEY,
  RANKED_DEFAULT_COOLDOWN_MINUTES,
  RANKED_DEFAULT_DAILY_ATTEMPT_LIMIT,
  RANKED_DEFAULT_WEEKLY_ATTEMPT_LIMIT,
  RANKED_MIGRATION_V1_CONFIRMATION,
} from "../constants";

const DEFAULT_SEASON_SLUG = "founding-season";
const DEFAULT_SEASON_NAME = "Founding Season";

export const backfillRankedModeV1 = mutation({
  args: {
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdminUser(ctx, "Only administrators can run ranked migrations.");
    const dryRun = args.dryRun ?? false;
    const now = Date.now();

    const existingConfig = await ctx.db
      .query("rankedSystemConfig")
      .withIndex("by_configKey", (q) => q.eq("configKey", RANKED_DEFAULT_CONFIG_KEY))
      .unique();

    const existingSeason = await ctx.db
      .query("rankedSeasons")
      .withIndex("by_slug", (q) => q.eq("slug", DEFAULT_SEASON_SLUG))
      .unique();

    if (!dryRun && !existingConfig) {
      await ctx.db.insert("rankedSystemConfig", {
        configKey: RANKED_DEFAULT_CONFIG_KEY,
        rankedModeEnabled: true,
        requiresPassedExam: true,
        cooldownMinutes: RANKED_DEFAULT_COOLDOWN_MINUTES,
        dailyAttemptLimit: RANKED_DEFAULT_DAILY_ATTEMPT_LIMIT,
        weeklyAttemptLimit: RANKED_DEFAULT_WEEKLY_ATTEMPT_LIMIT,
        updatedBy: admin._id,
        createdAt: now,
        updatedAt: now,
      });
    }

    if (!dryRun && !existingSeason) {
      await ctx.db.insert("rankedSeasons", {
        slug: DEFAULT_SEASON_SLUG,
        name: DEFAULT_SEASON_NAME,
        startsAt: now,
        status: "active",
        description: "Initial ranked season bootstrapped by migration.",
        createdBy: admin._id,
        updatedBy: admin._id,
        createdAt: now,
        updatedAt: now,
      });
    }

    return {
      migrationVersion: "ranked_mode_v1",
      dryRun,
      configCreated: !existingConfig,
      seasonCreated: !existingSeason,
      generatedAt: now,
    };
  },
});

export const rollbackRankedModeV1 = mutation({
  args: {
    dryRun: v.optional(v.boolean()),
    confirmation: v.string(),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdminUser(ctx, "Only administrators can rollback ranked migrations.");

    if (args.confirmation !== RANKED_MIGRATION_V1_CONFIRMATION) {
      throw new Error("Invalid confirmation token for rollback.");
    }

    const dryRun = args.dryRun ?? false;
    const now = Date.now();

    const existingConfig = await ctx.db
      .query("rankedSystemConfig")
      .withIndex("by_configKey", (q) => q.eq("configKey", RANKED_DEFAULT_CONFIG_KEY))
      .unique();

    const existingSeason = await ctx.db
      .query("rankedSeasons")
      .withIndex("by_slug", (q) => q.eq("slug", DEFAULT_SEASON_SLUG))
      .unique();

    if (!dryRun && existingConfig) {
      await ctx.db.patch(existingConfig._id, {
        rankedModeEnabled: false,
        updatedBy: admin._id,
        updatedAt: now,
      });
    }

    if (!dryRun && existingSeason) {
      await ctx.db.patch(existingSeason._id, {
        status: "archived",
        endsAt: existingSeason.endsAt ?? now,
        updatedBy: admin._id,
        updatedAt: now,
      });
    }

    return {
      migrationVersion: "ranked_mode_v1",
      dryRun,
      configDisabled: Boolean(existingConfig),
      seasonArchived: Boolean(existingSeason),
      generatedAt: now,
    };
  },
});
