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
  return (
    run.status === "completed" &&
    run.completedAt !== undefined &&
    run.antiCheatStatus === "clear"
  );
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
