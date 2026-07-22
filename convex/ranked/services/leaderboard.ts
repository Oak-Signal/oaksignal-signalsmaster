import { Doc, Id } from "../../_generated/dataModel";
import { QueryCtx, MutationCtx } from "../../_generated/server";

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
  seasonId: Id<"rankedSeasons">
): Promise<LeaderboardEntry[]> {
  const seasonRuns = await ctx.db
    .query("rankedRuns")
    .withIndex("by_season_completedAt", (q) => q.eq("seasonId", seasonId))
    .order("desc")
    .collect();

  const bestRunByUser = new Map<string, LeaderboardEntry>();

  for (const run of seasonRuns) {
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
