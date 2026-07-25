import { MutationCtx, mutation, query } from "../../_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "../../_generated/dataModel";

import { requireAdminUser } from "../../lib/auth";
import {
  RANKED_DEFAULT_CONFIG_KEY,
  RANKED_DEFAULT_COOLDOWN_MINUTES,
  RANKED_DEFAULT_DAILY_ATTEMPT_LIMIT,
  RANKED_DEFAULT_WEEKLY_ATTEMPT_LIMIT,
} from "../constants";
import {
  getActiveRankedSeason,
  getRankedSystemConfig,
  getResolvedPolicyConfig,
} from "../services/runtime";
import { formatLeaderboardDisplayName } from "../services/leaderboard";
import { insertRankedTimingAudit, parseSuspiciousFlags } from "./runtime";

// Anti-cheat statuses that represent a run the anti-cheat system has flagged for
// admin attention (FR-022). "clear" runs never need admin review.
const FLAGGED_ANTI_CHEAT_STATUSES: Array<Doc<"rankedRuns">["antiCheatStatus"]> = [
  "flagged",
  "reviewing",
  "disqualified",
];

const DEFAULT_INTEGRITY_QUEUE_LIMIT = 50;
const MAX_INTEGRITY_QUEUE_LIMIT = 200;

const ANOMALY_AUDIT_EVENT_TYPES = new Set(["timing_flagged", "replay_flagged"]);

function assertSeasonWindow(startsAt: number, endsAt?: number | null): void {
  if (!Number.isFinite(startsAt) || startsAt <= 0) {
    throw new Error("Season startsAt must be a valid timestamp.");
  }

  if (endsAt !== undefined && endsAt !== null && endsAt <= startsAt) {
    throw new Error("Season endsAt must be greater than startsAt.");
  }
}

async function ensureRankedConfig(
  ctx: MutationCtx,
  adminId: Id<"users">,
  now: number
) {
  const existing = await getRankedSystemConfig(ctx);

  if (existing) {
    return existing;
  }

  const configId = await ctx.db.insert("rankedSystemConfig", {
    configKey: RANKED_DEFAULT_CONFIG_KEY,
    rankedModeEnabled: false,
    requiresPassedExam: true,
    cooldownMinutes: RANKED_DEFAULT_COOLDOWN_MINUTES,
    dailyAttemptLimit: RANKED_DEFAULT_DAILY_ATTEMPT_LIMIT,
    weeklyAttemptLimit: RANKED_DEFAULT_WEEKLY_ATTEMPT_LIMIT,
    updatedBy: adminId,
    createdAt: now,
    updatedAt: now,
  });

  return ctx.db.get(configId);
}

export const getRankedAdminState = query({
  args: {},
  handler: async (ctx) => {
    const admin = await requireAdminUser(ctx, "Only administrators can access ranked settings.");

    const [configDoc, activeSeason, recentSeasons] = await Promise.all([
      getRankedSystemConfig(ctx),
      getActiveRankedSeason(ctx),
      ctx.db
        .query("rankedSeasons")
        .withIndex("by_startsAt")
        .order("desc")
        .take(25),
    ]);

    const resolved = getResolvedPolicyConfig(configDoc);

    return {
      generatedAt: Date.now(),
      adminUserId: admin._id,
      rankedConfig: {
        configExists: configDoc !== null,
        rankedModeEnabled: resolved.rankedModeEnabled,
        requiresPassedExam: resolved.requiresPassedExam,
        cooldownMinutes: resolved.cooldownMinutes,
        dailyAttemptLimit: resolved.dailyAttemptLimit,
        weeklyAttemptLimit: resolved.weeklyAttemptLimit,
        updatedAt: configDoc?.updatedAt ?? null,
        updatedBy: configDoc?.updatedBy ?? null,
      },
      activeSeason: activeSeason
        ? {
            seasonId: activeSeason._id,
            slug: activeSeason.slug,
            name: activeSeason.name,
            status: activeSeason.status,
            startsAt: activeSeason.startsAt,
            endsAt: activeSeason.endsAt ?? null,
            updatedAt: activeSeason.updatedAt,
          }
        : null,
      seasons: recentSeasons.map((season) => ({
        seasonId: season._id,
        slug: season.slug,
        name: season.name,
        status: season.status,
        startsAt: season.startsAt,
        endsAt: season.endsAt ?? null,
        createdAt: season.createdAt,
        updatedAt: season.updatedAt,
      })),
    };
  },
});

export const setRankedModeEnabled = mutation({
  args: {
    enabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdminUser(ctx, "Only administrators can update ranked mode settings.");
    const now = Date.now();

    const config = await ensureRankedConfig(ctx, admin._id, now);
    if (!config) {
      throw new Error("Unable to initialize ranked system configuration.");
    }

    await ctx.db.patch(config._id, {
      rankedModeEnabled: args.enabled,
      updatedBy: admin._id,
      updatedAt: now,
    });

    return {
      rankedModeEnabled: args.enabled,
      updatedAt: now,
      updatedBy: admin._id,
    };
  },
});

export const updateRankedPolicySettings = mutation({
  args: {
    requiresPassedExam: v.optional(v.boolean()),
    cooldownMinutes: v.optional(v.number()),
    dailyAttemptLimit: v.optional(v.union(v.number(), v.null())),
    weeklyAttemptLimit: v.optional(v.union(v.number(), v.null())),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdminUser(ctx, "Only administrators can update ranked policy settings.");
    const now = Date.now();

    const config = await ensureRankedConfig(ctx, admin._id, now);
    if (!config) {
      throw new Error("Unable to initialize ranked system configuration.");
    }

    const patch: {
      requiresPassedExam?: boolean;
      cooldownMinutes?: number;
      dailyAttemptLimit?: number | undefined;
      weeklyAttemptLimit?: number | undefined;
      updatedBy: typeof admin._id;
      updatedAt: number;
    } = {
      updatedBy: admin._id,
      updatedAt: now,
    };

    if (args.requiresPassedExam !== undefined) {
      patch.requiresPassedExam = args.requiresPassedExam;
    }

    if (args.cooldownMinutes !== undefined) {
      if (!Number.isInteger(args.cooldownMinutes) || args.cooldownMinutes < 0) {
        throw new Error("cooldownMinutes must be an integer greater than or equal to 0.");
      }
      patch.cooldownMinutes = args.cooldownMinutes;
    }

    if (args.dailyAttemptLimit !== undefined) {
      if (args.dailyAttemptLimit !== null && (!Number.isInteger(args.dailyAttemptLimit) || args.dailyAttemptLimit < 1)) {
        throw new Error("dailyAttemptLimit must be null or an integer greater than or equal to 1.");
      }
      patch.dailyAttemptLimit = args.dailyAttemptLimit ?? undefined;
    }

    if (args.weeklyAttemptLimit !== undefined) {
      if (args.weeklyAttemptLimit !== null && (!Number.isInteger(args.weeklyAttemptLimit) || args.weeklyAttemptLimit < 1)) {
        throw new Error("weeklyAttemptLimit must be null or an integer greater than or equal to 1.");
      }
      patch.weeklyAttemptLimit = args.weeklyAttemptLimit ?? undefined;
    }

    await ctx.db.patch(config._id, patch);

    const refreshed = await ctx.db.get(config._id);
    const resolved = getResolvedPolicyConfig(refreshed);

    return {
      updatedAt: now,
      updatedBy: admin._id,
      rankedModeEnabled: resolved.rankedModeEnabled,
      requiresPassedExam: resolved.requiresPassedExam,
      cooldownMinutes: resolved.cooldownMinutes,
      dailyAttemptLimit: resolved.dailyAttemptLimit,
      weeklyAttemptLimit: resolved.weeklyAttemptLimit,
    };
  },
});

export const createRankedSeason = mutation({
  args: {
    slug: v.string(),
    name: v.string(),
    startsAt: v.number(),
    endsAt: v.optional(v.union(v.number(), v.null())),
    description: v.optional(v.string()),
    activateNow: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdminUser(ctx, "Only administrators can create ranked seasons.");

    const slug = args.slug.trim().toLowerCase();
    const name = args.name.trim();

    if (slug.length < 3) {
      throw new Error("Season slug must be at least 3 characters.");
    }

    if (name.length < 3) {
      throw new Error("Season name must be at least 3 characters.");
    }

    assertSeasonWindow(args.startsAt, args.endsAt ?? undefined);

    const existing = await ctx.db
      .query("rankedSeasons")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();

    if (existing) {
      throw new Error("A season with this slug already exists.");
    }

    const now = Date.now();
    const activateNow = args.activateNow ?? false;

    if (activateNow) {
      const activeSeasons = await ctx.db
        .query("rankedSeasons")
        .withIndex("by_status_startsAt", (q) => q.eq("status", "active"))
        .order("desc")
        .collect();

      for (const season of activeSeasons) {
        await ctx.db.patch(season._id, {
          status: "completed",
          endsAt: season.endsAt ?? now,
          updatedBy: admin._id,
          updatedAt: now,
        });
      }
    }

    const seasonId = await ctx.db.insert("rankedSeasons", {
      slug,
      name,
      startsAt: activateNow ? Math.min(args.startsAt, now) : args.startsAt,
      endsAt: args.endsAt ?? undefined,
      status: activateNow ? "active" : "upcoming",
      description: args.description?.trim() || undefined,
      createdBy: admin._id,
      updatedBy: admin._id,
      createdAt: now,
      updatedAt: now,
    });

    const season = await ctx.db.get(seasonId);

    return {
      seasonId,
      slug: season?.slug ?? slug,
      status: season?.status ?? (activateNow ? "active" : "upcoming"),
      activateNow,
      createdAt: now,
    };
  },
});

export const activateRankedSeason = mutation({
  args: {
    seasonId: v.id("rankedSeasons"),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdminUser(ctx, "Only administrators can activate ranked seasons.");

    const season = await ctx.db.get(args.seasonId);
    if (!season) {
      throw new Error("Ranked season not found.");
    }

    if (season.status === "archived") {
      throw new Error("Archived seasons cannot be reactivated.");
    }

    const now = Date.now();

    const activeSeasons = await ctx.db
      .query("rankedSeasons")
      .withIndex("by_status_startsAt", (q) => q.eq("status", "active"))
      .order("desc")
      .collect();

    for (const active of activeSeasons) {
      if (active._id === season._id) {
        continue;
      }

      await ctx.db.patch(active._id, {
        status: "completed",
        endsAt: active.endsAt ?? now,
        updatedBy: admin._id,
        updatedAt: now,
      });
    }

    await ctx.db.patch(season._id, {
      status: "active",
      startsAt: Math.min(season.startsAt, now),
      updatedBy: admin._id,
      updatedAt: now,
    });

    return {
      seasonId: season._id,
      status: "active",
      activatedAt: now,
    };
  },
});

export const archiveRankedSeason = mutation({
  args: {
    seasonId: v.id("rankedSeasons"),
    endNow: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdminUser(ctx, "Only administrators can archive ranked seasons.");

    const season = await ctx.db.get(args.seasonId);
    if (!season) {
      throw new Error("Ranked season not found.");
    }

    const now = Date.now();
    const endNow = args.endNow ?? true;

    await ctx.db.patch(season._id, {
      status: "archived",
      endsAt: endNow ? season.endsAt ?? now : season.endsAt,
      updatedBy: admin._id,
      updatedAt: now,
    });

    return {
      seasonId: season._id,
      status: "archived",
      archivedAt: now,
      endsAt: endNow ? season.endsAt ?? now : season.endsAt ?? null,
    };
  },
});

/**
 * Admin ranked anti-cheat review queue (US7 / FR-022): lists ranked runs the anti-cheat
 * system has flagged (any `antiCheatStatus` other than "clear"), each with the cadet/season
 * context, the suspicious-flag/severity detail computed at finalization, and the supporting
 * `rankedTimingAudit` timing/replay anomaly events, so an admin can triage without leaving
 * the panel.
 */
export const getRankedIntegrityQueue = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdminUser(ctx, "Only administrators can access the ranked integrity queue.");

    const limit = Math.min(
      Math.max(args.limit ?? DEFAULT_INTEGRITY_QUEUE_LIMIT, 1),
      MAX_INTEGRITY_QUEUE_LIMIT
    );

    const runsByStatus = await Promise.all(
      FLAGGED_ANTI_CHEAT_STATUSES.map((status) =>
        ctx.db
          .query("rankedRuns")
          .withIndex("by_anticheat_completedAt", (q) => q.eq("antiCheatStatus", status))
          .order("desc")
          .take(limit)
      )
    );

    const runs = runsByStatus
      .flat()
      .sort((a, b) => (b.completedAt ?? b.updatedAt) - (a.completedAt ?? a.updatedAt))
      .slice(0, limit);

    const items = await Promise.all(
      runs.map(async (run) => {
        const [user, season, auditEvents] = await Promise.all([
          ctx.db.get(run.userId),
          ctx.db.get(run.seasonId),
          ctx.db
            .query("rankedTimingAudit")
            .withIndex("by_run_createdAt", (q) => q.eq("runId", run._id))
            .order("desc")
            .collect(),
        ]);

        const timingAnomalies = auditEvents
          .filter((event) => ANOMALY_AUDIT_EVENT_TYPES.has(event.eventType))
          .map((event) => ({
            eventId: event._id,
            eventType: event.eventType,
            reason: event.reason ?? null,
            createdAt: event.createdAt,
          }));

        return {
          runId: run._id,
          userId: run.userId,
          userName: user ? formatLeaderboardDisplayName(user.name, user.email) : "Unknown Cadet",
          userEmail: user?.email ?? null,
          seasonId: run.seasonId,
          seasonName: season?.name ?? "Unknown Season",
          status: run.status,
          antiCheatStatus: run.antiCheatStatus,
          reviewStatus: run.reviewStatus,
          score: run.score,
          accuracyPercent: run.accuracyPercent,
          runDurationMs: run.runDurationMs ?? null,
          completedAt: run.completedAt ?? null,
          suspiciousFlags: parseSuspiciousFlags(run.suspiciousFlagsJson),
          suspiciousReason: run.suspiciousReason ?? null,
          suspiciousSeverity: run.suspiciousSeverity ?? null,
          integrityScore: run.integrityScore ?? null,
          timingAnomalies,
        };
      })
    );

    return {
      generatedAt: Date.now(),
      items,
    };
  },
});

/**
 * Admin ranked anti-cheat review workflow (US7 / FR-023): progresses a flagged run's
 * `reviewStatus` through the existing schema states (`pending` while an admin is actively
 * reviewing it, `confirmed` once the violation is confirmed, `dismissed` once cleared as a
 * false positive). `confirmed` is the sole state `isEligibleLeaderboardRun` (see
 * `convex/ranked/services/leaderboard.ts`) treats as excluded from standings — the run's
 * immutable `score`/`pointsFromTime`/`pointsFromAccuracy` fields are never touched. Every
 * transition writes an `admin_reviewed` audit entry.
 */
export const reviewRankedRun = mutation({
  args: {
    runId: v.id("rankedRuns"),
    reviewStatus: v.union(
      v.literal("pending"),
      v.literal("confirmed"),
      v.literal("dismissed")
    ),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdminUser(ctx, "Only administrators can review ranked runs.");

    const run = await ctx.db.get(args.runId);
    if (!run) {
      throw new Error("Ranked run not found.");
    }

    if (run.antiCheatStatus === "clear" && run.reviewStatus === "none") {
      throw new Error("This run has no anti-cheat flags to review.");
    }

    const now = Date.now();
    const previousReviewStatus = run.reviewStatus;
    const trimmedNote = args.note?.trim();

    await ctx.db.patch(run._id, {
      reviewStatus: args.reviewStatus,
      updatedAt: now,
    });

    await insertRankedTimingAudit(ctx, {
      runId: run._id,
      userId: run.userId,
      eventType: "admin_reviewed",
      requestReceivedAt: now,
      reason: trimmedNote && trimmedNote.length > 0 ? trimmedNote : undefined,
      metadata: {
        adminUserId: admin._id,
        previousReviewStatus,
        newReviewStatus: args.reviewStatus,
      },
    });

    return {
      runId: run._id,
      reviewStatus: args.reviewStatus,
      reviewedAt: now,
      reviewedBy: admin._id,
    };
  },
});
