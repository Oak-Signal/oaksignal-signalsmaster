import { Doc, Id } from "../../_generated/dataModel";
import { QueryCtx, MutationCtx } from "../../_generated/server";
import { getFleetRankForPosition } from "./rank_tiers";

type RankedCtx = QueryCtx | MutationCtx;

export interface LeaderboardEntry {
  userId: Id<"users">;
  runId: Id<"rankedRuns">;
  score: number;
  runDurationMs: number;
  accuracyPercent: number;
  completedAt: number;
}

function isEligibleLeaderboardRun(run: Doc<"rankedRuns">): boolean {
  // Voided/incomplete runs (FR-008a) are excluded via `status !== "completed"`.
  // Only admin-confirmed (invalidated) runs are excluded for integrity reasons —
  // a run merely "flagged" for soft-anomaly review is still accepted per the
  // hybrid anti-cheat model (FR-011a) and continues to count until an admin
  // confirms the violation (`reviewStatus === "confirmed"`).
  return (
    run.status === "completed" &&
    run.completedAt !== undefined &&
    run.reviewStatus !== "confirmed"
  );
}

/**
 * Extracts a display-friendly "First Last" name from a stored user name or
 * email address. Handles dotted/underscored email-local-part style values
 * (e.g. "joe.bloggins@example.com" or a `name` of "joe.bloggins") by taking
 * the local part before "@", splitting on non-letter separators, and
 * Title-Casing each segment. Falls back to Title-Casing whitespace-separated
 * words when no "@" is present.
 */
export function formatLeaderboardDisplayName(
  rawName: string | undefined,
  email: string
): string {
  const source = rawName?.trim() || email;
  const localPart = source.includes("@") ? source.split("@")[0] : source;

  const words = localPart
    .split(/[^a-zA-Z0-9]+/)
    .map((word) => word.trim())
    .filter((word) => word.length > 0);

  if (words.length === 0) {
    return "Unknown Cadet";
  }

  return words
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function compareEntries(a: LeaderboardEntry, b: LeaderboardEntry): number {
  if (b.score !== a.score) {
    return b.score - a.score;
  }

  if (a.runDurationMs !== b.runDurationMs) {
    return a.runDurationMs - b.runDurationMs;
  }

  if (b.accuracyPercent !== a.accuracyPercent) {
    return b.accuracyPercent - a.accuracyPercent;
  }

  if (a.completedAt !== b.completedAt) {
    return a.completedAt - b.completedAt;
  }

  return a.userId.toString().localeCompare(b.userId.toString());
}

function toEntry(run: Doc<"rankedRuns">): LeaderboardEntry {
  return {
    userId: run.userId,
    runId: run._id,
    score: run.score,
    runDurationMs: run.runDurationMs ?? Number.MAX_SAFE_INTEGER,
    accuracyPercent: run.accuracyPercent,
    completedAt: run.completedAt ?? run.updatedAt,
  };
}

export async function getSeasonLeaderboard(
  ctx: RankedCtx,
  seasonId: Id<"rankedSeasons">,
  options?: { excludeRunId?: Id<"rankedRuns"> }
): Promise<LeaderboardEntry[]> {
  const seasonRuns = await ctx.db
    .query("rankedRuns")
    .withIndex("by_season_completedAt", (q) => q.eq("seasonId", seasonId))
    .order("desc")
    .collect();

  const bestRunByUser = new Map<string, LeaderboardEntry>();

  for (const run of seasonRuns) {
    if (options?.excludeRunId && run._id === options.excludeRunId) {
      continue;
    }

    if (!isEligibleLeaderboardRun(run)) {
      continue;
    }

    const candidate = toEntry(run);
    const key = run.userId.toString();
    const existing = bestRunByUser.get(key);

    if (!existing || compareEntries(candidate, existing) < 0) {
      bestRunByUser.set(key, candidate);
    }
  }

  const entries = [...bestRunByUser.values()];
  entries.sort(compareEntries);
  return entries;
}

export interface RankedRunRankChange {
  previousPosition: number | null;
  currentPosition: number | null;
  positionDelta: number | null;
  previousRankTitle: string | null;
  currentRankTitle: string;
  direction: "up" | "down" | "same" | "new";
}

/**
 * Derives the rank-progression change caused by a specific finalized run (US5/FR-018) by
 * comparing the season leaderboard with vs. without that run. This is fully server-derived
 * and deterministic — it does not rely on any stored "previous rank" snapshot. A run that
 * was not the cadet's new best has no effect on their standing, so `direction` is "same".
 */
export async function computeRankedRunRankChange(
  ctx: RankedCtx,
  run: Doc<"rankedRuns">
): Promise<RankedRunRankChange | null> {
  if (run.status !== "completed" || run.reviewStatus === "confirmed") {
    return null;
  }

  const [currentLeaderboard, previousLeaderboard] = await Promise.all([
    getSeasonLeaderboard(ctx, run.seasonId),
    getSeasonLeaderboard(ctx, run.seasonId, { excludeRunId: run._id }),
  ]);

  const currentIndex = currentLeaderboard.findIndex((entry) => entry.userId === run.userId);
  const previousIndex = previousLeaderboard.findIndex((entry) => entry.userId === run.userId);

  const currentPosition = currentIndex >= 0 ? currentIndex + 1 : null;
  const previousPosition = previousIndex >= 0 ? previousIndex + 1 : null;

  const currentRankTitle =
    currentPosition !== null ? getFleetRankForPosition(currentPosition).title : "Unranked";
  const previousRankTitle =
    previousPosition !== null ? getFleetRankForPosition(previousPosition).title : null;

  let direction: "up" | "down" | "same" | "new";
  let positionDelta: number | null = null;

  if (previousPosition === null && currentPosition !== null) {
    direction = "new";
  } else if (previousPosition !== null && currentPosition !== null) {
    // Lower position number is better; a positive delta means the cadet moved up.
    positionDelta = previousPosition - currentPosition;
    if (positionDelta > 0) {
      direction = "up";
    } else if (positionDelta < 0) {
      direction = "down";
    } else {
      direction = "same";
    }
  } else {
    direction = "same";
  }

  return {
    previousPosition,
    currentPosition,
    positionDelta,
    previousRankTitle,
    currentRankTitle,
    direction,
  };
}
