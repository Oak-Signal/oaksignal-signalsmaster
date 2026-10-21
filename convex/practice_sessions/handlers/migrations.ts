/**
 * Repair migration for practice-session stat caches (specs/004-session-stats-audit, T017/FR-016).
 *
 * Recomputes the cached `score`, `correctCount`, and (when complete timing exists) `activeTimeMs`
 * of completed sessions from their raw answers using convex/lib/session_stats.ts. Dry-run by
 * default, paginated, and idempotent: rows already correct are never written.
 *
 * Internal only. Run from the CLI, following `continueCursor` until `isDone`:
 *   npx convex run practice_sessions/handlers/migrations:repairPracticeSessionStats "{}"
 *   npx convex run practice_sessions/handlers/migrations:repairPracticeSessionStats "{dryRun:false}"
 */
import { v } from "convex/values";
import { Doc, Id } from "../../_generated/dataModel";
import { internalMutation } from "../../_generated/server";
import {
  computeSessionActiveTimeMs,
  deriveSessionCorrectCount,
  deriveSessionScorePercent,
  hasCompleteTiming,
} from "../../lib/session_stats";

const DEFAULT_BATCH_SIZE = 100;
const MAX_BATCH_SIZE = 500;
const SAMPLE_LIMIT = 20;

export interface SessionStatsRepair {
  score?: number;
  correctCount?: number;
  activeTimeMs?: number;
}

/**
 * Fields whose cached value differs from the value derived from raw answers.
 * Returns `null` when nothing needs to change or the row cannot be repaired (legacy rows without
 * `questions`, or non-completed sessions).
 */
export function planSessionStatsRepair(
  session: Doc<"practiceSessions">
): SessionStatsRepair | null {
  if (session.status !== "completed" || session.questions === undefined) {
    return null;
  }

  const patch: SessionStatsRepair = {};

  const score = deriveSessionScorePercent(session);
  if (session.score !== score) {
    patch.score = score;
  }

  const correctCount = deriveSessionCorrectCount(session);
  if (session.correctCount !== correctCount) {
    patch.correctCount = correctCount;
  }

  if (hasCompleteTiming(session)) {
    const activeTimeMs = computeSessionActiveTimeMs(session);
    if (session.activeTimeMs !== activeTimeMs) {
      patch.activeTimeMs = activeTimeMs;
    }
  }

  return Object.keys(patch).length > 0 ? patch : null;
}

export const repairPracticeSessionStats = internalMutation({
  args: {
    dryRun: v.optional(v.boolean()),
    cursor: v.optional(v.union(v.string(), v.null())),
    batchSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const dryRun = args.dryRun ?? true;
    const batchSize = Math.min(
      MAX_BATCH_SIZE,
      Math.max(1, Math.trunc(args.batchSize ?? DEFAULT_BATCH_SIZE))
    );

    const page = await ctx.db
      .query("practiceSessions")
      .withIndex("by_status", (q) => q.eq("status", "completed"))
      .paginate({ numItems: batchSize, cursor: args.cursor ?? null });

    let skippedLegacy = 0;
    let rowsNeedingRepair = 0;
    const sample: Array<{
      sessionId: Id<"practiceSessions">;
      before: SessionStatsRepair;
      after: SessionStatsRepair;
    }> = [];

    for (const session of page.page) {
      if (session.questions === undefined) {
        skippedLegacy += 1;
        continue;
      }

      const patch = planSessionStatsRepair(session);
      if (!patch) {
        continue;
      }

      rowsNeedingRepair += 1;
      if (sample.length < SAMPLE_LIMIT) {
        const before: SessionStatsRepair = {};
        if (patch.score !== undefined) before.score = session.score;
        if (patch.correctCount !== undefined) before.correctCount = session.correctCount;
        if (patch.activeTimeMs !== undefined) before.activeTimeMs = session.activeTimeMs;
        sample.push({ sessionId: session._id, before, after: patch });
      }

      if (!dryRun) {
        await ctx.db.patch(session._id, patch);
      }
    }

    return {
      dryRun,
      scanned: page.page.length,
      skippedLegacy,
      rowsNeedingRepair,
      rowsChanged: dryRun ? 0 : rowsNeedingRepair,
      sample,
      continueCursor: page.continueCursor,
      isDone: page.isDone,
    };
  },
});
