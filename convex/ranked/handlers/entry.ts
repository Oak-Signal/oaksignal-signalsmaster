import { query } from "../../_generated/server";

import { getAuthenticatedUser } from "../../lib/auth";
import {
  FLEET_RANKS,
  RANKED_ESTIMATED_MS_PER_FLAG,
  RANKED_RULES,
} from "../constants";
import { evaluateRankedAttemptPolicy } from "../services/attempt_policy";
import { getRankedEligibility } from "../services/eligibility";
import { formatLeaderboardDisplayName, getSeasonLeaderboard } from "../services/leaderboard";
import { getFleetRankForPosition } from "../services/rank_tiers";
import {
  getActiveRankedSeason,
  getRankedSystemConfig,
  getResolvedPolicyConfig,
} from "../services/runtime";

function getNextPromotion(input: {
  position: number | null;
  score: number | null;
  leaderboardScores: number[];
}) {
  if (input.position === null || input.score === null) {
    return {
      targetPosition: null as number | null,
      pointsRequired: null as number | null,
      label: "Complete your first ranked run to earn a fleet rank.",
    };
  }

  if (input.position <= 1) {
    return {
      targetPosition: null,
      pointsRequired: 0,
      label: "Top rank achieved.",
    };
  }

  let targetPosition = input.position - 1;

  for (const rank of FLEET_RANKS) {
    if (input.position >= rank.minPosition && input.position <= rank.maxPosition) {
      const betterTier = FLEET_RANKS.find((candidate) => candidate.maxPosition < rank.minPosition);
      if (betterTier) {
        targetPosition = betterTier.maxPosition;
      }
      break;
    }
  }

  const thresholdScore = input.leaderboardScores[targetPosition - 1] ?? input.score;
  const pointsRequired = Math.max(0, thresholdScore - input.score + 1);

  return {
    targetPosition,
    pointsRequired,
    label: `Reach top ${targetPosition} to earn promotion.`,
  };
}

function getEstimatedDurationMs(input: {
  flagCount: number;
  personalBestDurationMs: number | null;
  personalBestFlagCount: number | null;
}): number {
  if (
    input.personalBestDurationMs !== null &&
    input.personalBestFlagCount !== null &&
    input.personalBestFlagCount > 0
  ) {
    const perFlagMs = input.personalBestDurationMs / input.personalBestFlagCount;
    return Math.round(perFlagMs * input.flagCount * 1.05);
  }

  return input.flagCount * RANKED_ESTIMATED_MS_PER_FLAG;
}

export const getRankedEntryContext = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user) {
      return null;
    }

    const [configDoc, season, flags] = await Promise.all([
      getRankedSystemConfig(ctx),
      getActiveRankedSeason(ctx),
      ctx.db.query("flags").collect(),
    ]);

    const resolvedConfig = getResolvedPolicyConfig(configDoc);

    const eligibility = await getRankedEligibility(
      ctx,
      user,
      resolvedConfig,
      season !== null
    );

    const attemptPolicy = await evaluateRankedAttemptPolicy(ctx, user._id, {
      cooldownMinutes: resolvedConfig.cooldownMinutes,
      dailyAttemptLimit: resolvedConfig.dailyAttemptLimit,
      weeklyAttemptLimit: resolvedConfig.weeklyAttemptLimit,
    });

    const leaderboard = season ? await getSeasonLeaderboard(ctx, season._id) : [];
    const leaderboardScores = leaderboard.map((entry) => entry.score);
    const userPosition = leaderboard.findIndex((entry) => entry.userId === user._id);
    const userEntry = userPosition >= 0 ? leaderboard[userPosition] : null;

    const topPreview = await Promise.all(
      leaderboard.slice(0, 3).map(async (entry, index) => {
        const rankedUser = await ctx.db.get(entry.userId);
        const rankInfo = getFleetRankForPosition(index + 1);

        return {
          position: index + 1,
          userId: entry.userId,
          name: formatLeaderboardDisplayName(rankedUser?.name, rankedUser?.email ?? ""),
          score: entry.score,
          runDurationMs: entry.runDurationMs,
          accuracyPercent: entry.accuracyPercent,
          rankTitle: rankInfo.title,
          rankBadge: rankInfo.badge,
          rankAccent: rankInfo.accent,
        };
      })
    );

    const recentRuns = await ctx.db
      .query("rankedRuns")
      .withIndex("by_user_startedAt", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(5);

    const rankInfo =
      userPosition >= 0 ? getFleetRankForPosition(userPosition + 1) : null;

    const personalBest = userEntry
      ? {
          score: userEntry.score,
          runDurationMs: userEntry.runDurationMs,
          accuracyPercent: userEntry.accuracyPercent,
          flagCount: recentRuns.find((run) => run._id === userEntry.runId)?.flagCount ?? null,
        }
      : {
          score: null,
          runDurationMs: null,
          accuracyPercent: null,
          flagCount: null,
        };

    const nextPromotion = getNextPromotion({
      position: userPosition >= 0 ? userPosition + 1 : null,
      score: userEntry?.score ?? null,
      leaderboardScores,
    });

    const estimatedDurationMs = getEstimatedDurationMs({
      flagCount: flags.length,
      personalBestDurationMs: personalBest.runDurationMs,
      personalBestFlagCount: personalBest.flagCount,
    });

    return {
      generatedAt: Date.now(),
      season: season
        ? {
            seasonId: season._id,
            slug: season.slug,
            name: season.name,
            startsAt: season.startsAt,
            endsAt: season.endsAt ?? null,
            status: season.status,
          }
        : null,
      rank: {
        isRanked: userPosition >= 0,
        currentRankTitle: rankInfo?.title ?? "Unranked",
        badge: rankInfo?.badge ?? "none",
        accent: rankInfo?.accent ?? "standard",
        leaderboardPosition: userPosition >= 0 ? userPosition + 1 : null,
        leaderboardTotalPlayers: leaderboard.length,
      },
      personalBest,
      nextPromotion,
      entryRequirements: {
        requiresPassedFormalExam: resolvedConfig.requiresPassedExam,
        hasPassedFormalExam: eligibility.hasPassedFormalExam,
        unmetRequirements: eligibility.reasons,
      },
      attemptPolicy,
      canEnterRankedMode: eligibility.isEligible && attemptPolicy.canStart,
      runOverview: {
        flagCount: flags.length,
        estimatedDurationMs,
      },
      rules: {
        items: RANKED_RULES,
      },
      leaderboardPreview: topPreview,
      recentHistory: recentRuns.map((run) => ({
        runId: run._id,
        status: run.status,
        score: run.score,
        runDurationMs: run.runDurationMs ?? null,
        accuracyPercent: run.accuracyPercent,
        antiCheatStatus: run.antiCheatStatus,
        reviewStatus: run.reviewStatus,
        startedAt: run.startedAt,
        completedAt: run.completedAt ?? null,
      })),
    };
  },
});
