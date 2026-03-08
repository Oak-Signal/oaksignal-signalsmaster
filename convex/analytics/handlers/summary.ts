import { v } from "convex/values";
import { query } from "../../_generated/server";
import { getAuthenticatedUser } from "../services/auth";
import { dateRangeCutoff } from "../services/dateRange";

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

    const allCompleted = await ctx.db
      .query("practiceSessions")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", user._id).eq("status", "completed")
      )
      .collect();

    const sessions = allCompleted.filter(
      (session) => cutoff === 0 || (session.completedAt ?? 0) >= cutoff
    );

    const totalSessions = sessions.length;
    if (totalSessions === 0) {
      return {
        totalSessions: 0,
        averageScore: 0,
        bestScore: 0,
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

    const totalScore = sessions.reduce((sum, session) => sum + session.score, 0);
    const averageScore = Math.round(totalScore / totalSessions);
    const bestScore = Math.max(...sessions.map((session) => session.score));

    const totalTimePracticed = sessions.reduce(
      (sum, session) => sum + (session.timeTaken ?? 0),
      0
    );
    const avgSessionTime = Math.round(totalTimePracticed / totalSessions);

    const modeTally: Record<
      "learn" | "match",
      { sessions: number; correct: number; attempts: number }
    > = {
      learn: { sessions: 0, correct: 0, attempts: 0 },
      match: { sessions: 0, correct: 0, attempts: 0 },
    };

    for (const session of sessions) {
      const bucket = modeTally[session.mode];
      bucket.sessions += 1;

      if (session.questions && session.questions.length > 0) {
        bucket.attempts += session.questions.length;
        bucket.correct += session.questions.filter(
          (question) => question.userAnswer === question.correctAnswer
        ).length;
      } else {
        const attempts = session.sessionLength;
        const correct = Math.round((session.score / 100) * attempts);
        bucket.attempts += attempts;
        bucket.correct += correct;
      }
    }

    const modeBreakdown = {
      learn: {
        sessions: modeTally.learn.sessions,
        successRate:
          modeTally.learn.attempts > 0
            ? Math.round((modeTally.learn.correct / modeTally.learn.attempts) * 100)
            : 0,
      },
      match: {
        sessions: modeTally.match.sessions,
        successRate:
          modeTally.match.attempts > 0
            ? Math.round((modeTally.match.correct / modeTally.match.attempts) * 100)
            : 0,
      },
    };

    const sortedByDate = [...allCompleted].sort(
      (a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0)
    );

    let longestStreak = 0;
    let currentStreak = 0;

    if (sortedByDate.length > 0) {
      const daySet = new Set<string>();
      for (const session of sortedByDate) {
        const date = new Date(session.completedAt ?? session.startedAt);
        daySet.add(date.toISOString().split("T")[0]);
      }

      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);

      let streak = 0;
      const cursor = new Date(today);
      while (true) {
        const key = cursor.toISOString().split("T")[0];
        if (daySet.has(key)) {
          streak++;
          cursor.setUTCDate(cursor.getUTCDate() - 1);
        } else if (streak === 0) {
          cursor.setUTCDate(cursor.getUTCDate() - 1);
          const yesterdayKey = cursor.toISOString().split("T")[0];
          if (daySet.has(yesterdayKey)) {
            streak++;
            cursor.setUTCDate(cursor.getUTCDate() - 1);
          } else {
            break;
          }
        } else {
          break;
        }
      }
      currentStreak = streak;

      const dayList = Array.from(daySet).sort();
      let best = 1;
      let run = 1;
      for (let i = 1; i < dayList.length; i++) {
        const previous = new Date(dayList[i - 1]);
        const current = new Date(dayList[i]);
        const diff = (current.getTime() - previous.getTime()) / (1000 * 60 * 60 * 24);
        if (diff === 1) {
          run++;
          best = Math.max(best, run);
        } else {
          run = 1;
        }
      }
      longestStreak = dayList.length > 0 ? best : 0;
    }

    const categoryTally = new Map<string, { attempts: number; correct: number }>();

    for (const session of sessions) {
      if (!session.questions) {
        continue;
      }

      for (const question of session.questions) {
        const flag = await ctx.db.get(question.flagId);
        if (!flag) {
          continue;
        }

        const existing = categoryTally.get(flag.category) ?? {
          attempts: 0,
          correct: 0,
        };
        existing.attempts += 1;
        if (question.userAnswer === question.correctAnswer) {
          existing.correct += 1;
        }
        categoryTally.set(flag.category, existing);
      }
    }

    const categoryBreakdown = Array.from(categoryTally.entries()).map(
      ([category, { attempts, correct }]) => ({
        category,
        attempts,
        correct,
        successRate: attempts > 0 ? Math.round((correct / attempts) * 100) : 0,
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
