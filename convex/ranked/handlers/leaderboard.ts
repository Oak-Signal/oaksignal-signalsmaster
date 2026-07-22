import { query } from "../../_generated/server";

import { getAuthenticatedUser } from "../../lib/auth";
import {
  formatLeaderboardDisplayName,
  getSeasonLeaderboard,
} from "../services/leaderboard";
import { getFleetRankForPosition } from "../services/rank_tiers";
import { getActiveRankedSeason } from "../services/runtime";

/**
 * Live, season-scoped leaderboard for the ranked leaderboard panel (US4).
 * Reactive via Convex `useQuery` — no polling required.
 */
export const getSeasonLeaderboardView = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthenticatedUser(ctx);
    const season = await getActiveRankedSeason(ctx);

    if (!season) {
      return {
        season: null,
        entries: [],
        totalPlayers: 0,
        generatedAt: Date.now(),
      };
    }

    const leaderboard = await getSeasonLeaderboard(ctx, season._id);

    const entries = await Promise.all(
      leaderboard.map(async (entry, index) => {
        const position = index + 1;
        const rankedUser = await ctx.db.get(entry.userId);
        const fleetRankDefinition = getFleetRankForPosition(position);

        return {
          position,
          userId: entry.userId,
          name: formatLeaderboardDisplayName(rankedUser?.name, rankedUser?.email ?? ""),
          score: entry.score,
          runDurationMs: entry.runDurationMs,
          accuracyPercent: entry.accuracyPercent,
          completedAt: entry.completedAt,
          fleetRank: {
            title: fleetRankDefinition.title,
            badge: fleetRankDefinition.badge,
            accent: fleetRankDefinition.accent,
            minPosition: fleetRankDefinition.minPosition,
            maxPosition: fleetRankDefinition.maxPosition,
          },
          isCurrentUser: user !== null && entry.userId === user._id,
        };
      })
    );

    return {
      season: {
        seasonId: season._id,
        slug: season.slug,
        name: season.name,
        startsAt: season.startsAt,
        endsAt: season.endsAt ?? null,
        status: season.status,
      },
      entries,
      totalPlayers: entries.length,
      generatedAt: Date.now(),
    };
  },
});
