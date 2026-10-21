import { v } from "convex/values";
import { query } from "../../_generated/server";
import { getAuthenticatedUser } from "../services/auth";
import { dateRangeCutoff } from "../services/dateRange";
import { tallyFlagsFromSessions } from "../services/flagTally";
import { getCompletedSessions } from "../services/sessions";
import { getFlagLookupByIds } from "../services/flagLookup";
import {
  computeAccuracy,
  computeAverageScore,
  computeBestScore,
  computeSessionDayStreaks,
  computeWorstScore,
  deriveSessionAnsweredCount,
  deriveSessionCorrectCount,
  deriveSessionScorePercent,
} from "../../lib/session_stats";

export const getAnalyticsSummary = query({
  args: {
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

    const allCompleted = await getCompletedSessions(ctx, user._id, "desc");

    const sessions = allCompleted.filter(
      (session) => cutoff === 0 || (session.completedAt ?? 0) >= cutoff
    );

    const totalSessions = sessions.length;
    if (totalSessions === 0) {
      return {
        totalSessions: 0,
        averageScore: 0,
        bestScore: 0,
        worstScore: 0,
        totalTimePracticed: 0,
        avgSessionTime: 0,
        longestStreak: 0,
        currentStreak: 0,
        modeBreakdown: {
          learn: { sessions: 0, successRate: 0 },
          match: { sessions: 0, successRate: 0 },
        },
        categoryBreakdown: [] as {
          category: string;
          attempts: number;
          correct: number;
          successRate: number;
        }[],
        weeklyFrequency: [] as { week: string; count: number }[],
      };
    }

    // Session-weighted score stats (docs/session-statistics.md#average-score).
    const scorePercents = sessions.map(deriveSessionScorePercent);
    const averageScore = computeAverageScore(scorePercents);
    const bestScore = computeBestScore(scorePercents);
    const worstScore = computeWorstScore(scorePercents);

    const totalTimePracticed = sessions.reduce(
      (sum, session) => sum + (session.timeTaken ?? 0),
      0
    );
    const avgSessionTime = Math.round(totalTimePracticed / totalSessions);

    // Question-weighted accuracy per mode (docs/session-statistics.md#accuracy).
    const modeTally: Record<
      "learn" | "match",
      { sessions: number; correct: number; answered: number }
    > = {
      learn: { sessions: 0, correct: 0, answered: 0 },
      match: { sessions: 0, correct: 0, answered: 0 },
    };

    for (const session of sessions) {
      const bucket = modeTally[session.mode];
      bucket.sessions += 1;
      bucket.correct += deriveSessionCorrectCount(session);
      bucket.answered += deriveSessionAnsweredCount(session);
    }

    const modeBreakdown = {
      learn: {
        sessions: modeTally.learn.sessions,
        successRate: computeAccuracy(modeTally.learn.correct, modeTally.learn.answered),
      },
      match: {
        sessions: modeTally.match.sessions,
        successRate: computeAccuracy(modeTally.match.correct, modeTally.match.answered),
      },
    };

    // Local-day streaks over all history, ignoring the date range
    // (docs/session-statistics.md#current-day-streak).
    const { current: currentStreak, longest: longestStreak } =
      computeSessionDayStreaks(allCompleted, Date.now());

    const flagTallies = tallyFlagsFromSessions(sessions, 0);
    const categoryTally = new Map<string, { attempts: number; correct: number }>();

    const flagLookup = await getFlagLookupByIds(
      ctx,
      flagTallies.map((row) => row.flagId)
    );

    for (const row of flagTallies) {
      const flag = flagLookup.get(row.flagId.toString());
      if (!flag) {
        continue;
      }

      const existing = categoryTally.get(flag.category) ?? {
        attempts: 0,
        correct: 0,
      };
      existing.attempts += row.attempts;
      existing.correct += row.attempts - row.misses;
      categoryTally.set(flag.category, existing);
    }

    const categoryBreakdown = Array.from(categoryTally.entries()).map(
      ([category, values]) => ({
        category,
        attempts: values.attempts,
        correct: values.correct,
        successRate:
          values.attempts > 0
            ? Math.round((values.correct / values.attempts) * 100)
            : 0,
      })
    );

    const weekTally = new Map<string, number>();
    for (const session of sessions) {
      const date = new Date(session.completedAt ?? session.startedAt);
      const year = date.getUTCFullYear();
      const startOfYear = new Date(Date.UTC(year, 0, 1));
      const dayOfYear =
        Math.floor((date.getTime() - startOfYear.getTime()) / 86400000) + 1;
      const weekNum = Math.ceil(dayOfYear / 7);
      const key = `${year}-W${String(weekNum).padStart(2, "0")}`;
      weekTally.set(key, (weekTally.get(key) ?? 0) + 1);
    }

    const weeklyFrequency = Array.from(weekTally.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([week, count]) => ({ week, count }));

    return {
      totalSessions,
      averageScore,
      bestScore,
      worstScore,
      totalTimePracticed,
      avgSessionTime,
      longestStreak,
      currentStreak,
      modeBreakdown,
      categoryBreakdown,
      weeklyFrequency,
    };
  },
});
