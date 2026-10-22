import { v } from "convex/values";
import { query } from "../../_generated/server";
import { getAuthenticatedUser } from "../services/auth";
import { dateRangeCutoff } from "../services/dateRange";
import { tallyFlagsFromSessions } from "../services/flagTally";
import { getCompletedSessions } from "../services/sessions";
import { getFlagLookupByIds } from "../services/flagLookup";
import { isFlagMastered } from "../../lib/session_stats";

export const getMostMissedFlags = query({
  args: {
    limit: v.optional(v.number()),
    dateRange: v.optional(
      v.union(v.literal("7d"), v.literal("30d"), v.literal("all"))
    ),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user) {
      return null;
    }

    const range = args.dateRange ?? "all";
    const cutoff = dateRangeCutoff(range);
    const limit = args.limit ?? 5;

    const sessions = await getCompletedSessions(ctx, user._id);
    const tallies = tallyFlagsFromSessions(sessions, cutoff);

    const sorted = tallies
      .filter((item) => item.misses > 0)
      .sort((a, b) => {
        const rateA = a.misses / a.attempts;
        const rateB = b.misses / b.attempts;
        if (rateB !== rateA) {
          return rateB - rateA;
        }
        return b.misses - a.misses;
      })
      .slice(0, limit);

    const flagLookup = await getFlagLookupByIds(
      ctx,
      sorted.map((item) => item.flagId)
    );

    const enriched = sorted.map((item) => {
      const flag = flagLookup.get(item.flagId.toString());
      if (!flag) {
        return null;
      }

      return {
        flagId: flag._id,
        flagKey: flag.key,
        flagName: flag.name,
        flagImagePath: flag.imagePath,
        flagCategory: flag.category,
        attempts: item.attempts,
        misses: item.misses,
        missRate: Math.round((item.misses / item.attempts) * 100),
      };
    });

    return enriched.filter(Boolean) as NonNullable<(typeof enriched)[number]>[];
  },
});

export const getMasteryFlags = query({
  args: {
    limit: v.optional(v.number()),
    dateRange: v.optional(
      v.union(v.literal("7d"), v.literal("30d"), v.literal("all"))
    ),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user) {
      return null;
    }

    const range = args.dateRange ?? "all";
    const cutoff = dateRangeCutoff(range);
    const limit = args.limit ?? 8;

    const sessions = await getCompletedSessions(ctx, user._id);
    const tallies = tallyFlagsFromSessions(sessions, cutoff);

    const mastered = tallies
      .filter(isFlagMastered)
      .sort((a, b) => b.attempts - a.attempts)
      .slice(0, limit);

    const flagLookup = await getFlagLookupByIds(
      ctx,
      mastered.map((item) => item.flagId)
    );

    const enriched = mastered.map((item) => {
      const flag = flagLookup.get(item.flagId.toString());
      if (!flag) {
        return null;
      }

      return {
        flagId: flag._id,
        flagKey: flag.key,
        flagName: flag.name,
        flagImagePath: flag.imagePath,
        flagCategory: flag.category,
        attempts: item.attempts,
      };
    });

    return enriched.filter(Boolean) as NonNullable<(typeof enriched)[number]>[];
  },
});
