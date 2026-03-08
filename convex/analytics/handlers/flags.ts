import { v } from "convex/values";
import { Id } from "../../_generated/dataModel";
import { query } from "../../_generated/server";
import { getAuthenticatedUser } from "../services/auth";
import { dateRangeCutoff } from "../services/dateRange";

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

    const sessions = await ctx.db
      .query("practiceSessions")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", user._id).eq("status", "completed")
      )
      .collect();

    const tally = new Map<
      string,
      { flagId: Id<"flags">; attempts: number; misses: number }
    >();

    for (const session of sessions) {
      if (cutoff > 0 && (session.completedAt ?? 0) < cutoff) {
        continue;
      }
      if (!session.questions) {
        continue;
      }

      for (const question of session.questions) {
        const key = question.flagId.toString();
        const existing = tally.get(key) ?? {
          flagId: question.flagId,
          attempts: 0,
          misses: 0,
        };
        existing.attempts += 1;
        if (question.userAnswer !== question.correctAnswer) {
          existing.misses += 1;
        }
        tally.set(key, existing);
      }
    }

    const sorted = Array.from(tally.values())
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

    const enriched = await Promise.all(
      sorted.map(async (item) => {
        const flag = await ctx.db.get(item.flagId);
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
      })
    );

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

    const sessions = await ctx.db
      .query("practiceSessions")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", user._id).eq("status", "completed")
      )
      .collect();

    const tally = new Map<
      string,
      { flagId: Id<"flags">; attempts: number; misses: number }
    >();

    for (const session of sessions) {
      if (cutoff > 0 && (session.completedAt ?? 0) < cutoff) {
        continue;
      }
      if (!session.questions) {
        continue;
      }

      for (const question of session.questions) {
        const key = question.flagId.toString();
        const existing = tally.get(key) ?? {
          flagId: question.flagId,
          attempts: 0,
          misses: 0,
        };
        existing.attempts += 1;
        if (question.userAnswer !== question.correctAnswer) {
          existing.misses += 1;
        }
        tally.set(key, existing);
      }
    }

    const mastered = Array.from(tally.values())
      .filter((item) => item.attempts >= 2 && item.misses === 0)
      .sort((a, b) => b.attempts - a.attempts)
      .slice(0, limit);

    const enriched = await Promise.all(
      mastered.map(async (item) => {
        const flag = await ctx.db.get(item.flagId);
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
      })
    );

    return enriched.filter(Boolean) as NonNullable<(typeof enriched)[number]>[];
  },
});
