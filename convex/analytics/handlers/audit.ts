/**
 * Internal audit oracle for practice-session statistics (specs/004-session-stats-audit, FR-014).
 *
 * Recomputes every stat in docs/session-statistics.md directly from raw `practiceSessions` rows
 * and reports row-level anomalies. It intentionally does NOT import convex/lib/session_stats.ts:
 * the logic below is a deliberately simple, independent reimplementation so the audit can catch
 * bugs in the canonical module. Keep it that way.
 *
 * Internal only (not callable from clients). Run with:
 *   npx convex run analytics/handlers/audit:auditUserSessionStats '{"clerkId":"<id>"}'
 */
import { v } from "convex/values";
import { Doc, Id } from "../../_generated/dataModel";
import { internalQuery } from "../../_generated/server";

const AUDIT_TIME_ZONE = "America/Toronto";
const AUDIT_RESPONSE_TIME_CAP_MS = 60_000;
const DAY_MS = 86_400_000;

type AuditDateRange = "7d" | "30d" | "all";

type AnomalyCode =
  | "SCORE_OUT_OF_RANGE"
  | "SCORE_MISMATCH"
  | "CORRECT_COUNT_MISMATCH"
  | "COMPLETED_WITH_UNANSWERED"
  | "MISSING_COMPLETED_AT"
  | "MISSING_TIME_TAKEN"
  | "DURATION_EXCEEDS_CAP"
  | "NO_QUESTIONS_LEGACY"
  | "ACTIVE_TIME_CACHE_MISMATCH";

interface Anomaly {
  code: AnomalyCode;
  sessionId: Id<"practiceSessions">;
  detail: string;
}

interface SessionFact {
  sessionId: Id<"practiceSessions">;
  mode: "learn" | "match";
  status: "active" | "completed" | "abandoned";
  startedAt: number;
  completedAt: number | null;
  localDay: string | null;
  inRange: boolean;
  stored: {
    score: number;
    correctCount: number;
    timeTaken: number | null;
    activeTimeMs: number | null;
  };
  recounted: {
    hasQuestions: boolean;
    total: number;
    answered: number;
    correct: number;
    scorePercent: number;
    hasCompleteTiming: boolean;
    responseTimesMs: number[];
    activeTimeMs: number;
  };
}

function localDayOf(timestamp: number): string {
  // "en-CA" formats as YYYY-MM-DD.
  return new Date(timestamp).toLocaleDateString("en-CA", { timeZone: AUDIT_TIME_ZONE });
}

function dayNumber(dayKey: string): number {
  const [y, m, d] = dayKey.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / DAY_MS;
}

function isoWeekOf(dayKey: string): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const weekday = date.getUTCDay() === 0 ? 7 : date.getUTCDay();
  const thursday = new Date(date.getTime() + (4 - weekday) * DAY_MS);
  const weekYear = thursday.getUTCFullYear();
  const jan1 = Date.UTC(weekYear, 0, 1);
  const week = Math.floor((thursday.getTime() - jan1) / DAY_MS / 7) + 1;
  return `${weekYear}-W${week < 10 ? "0" : ""}${week}`;
}

function buildFact(session: Doc<"practiceSessions">, cutoff: number): SessionFact {
  let total = 0;
  let answered = 0;
  let correct = 0;
  let timedAnswers = 0;
  const answerTimes: number[] = [];

  if (session.questions) {
    for (const question of session.questions) {
      total += 1;
      if (question.userAnswer !== null) {
        answered += 1;
        if (question.userAnswer === question.correctAnswer) {
          correct += 1;
        }
        if (typeof question.answeredAt === "number") {
          timedAnswers += 1;
          answerTimes.push(question.answeredAt);
        }
      }
    }
  } else {
    total = session.sessionLength;
    answered = session.sessionLength;
    correct = Math.max(0, Math.min(session.sessionLength, session.correctCount));
  }

  const hasCompleteTiming = answered > 0 && timedAnswers === answered;
  const responseTimesMs: number[] = [];
  if (hasCompleteTiming) {
    answerTimes.sort((a, b) => a - b);
    let previous = session.startedAt;
    for (const at of answerTimes) {
      let delta = at - previous;
      if (delta < 0) delta = 0;
      if (delta > AUDIT_RESPONSE_TIME_CAP_MS) delta = AUDIT_RESPONSE_TIME_CAP_MS;
      responseTimesMs.push(delta);
      previous = at;
    }
  }

  let activeTimeMs = 0;
  if (hasCompleteTiming) {
    for (const ms of responseTimesMs) activeTimeMs += ms;
  } else {
    const elapsed = session.timeTaken !== undefined && session.timeTaken > 0 ? session.timeTaken : 0;
    activeTimeMs = Math.min(elapsed, total * AUDIT_RESPONSE_TIME_CAP_MS);
  }

  const completedAt = session.completedAt ?? null;

  return {
    sessionId: session._id,
    mode: session.mode,
    status: session.status,
    startedAt: session.startedAt,
    completedAt,
    localDay: completedAt !== null ? localDayOf(completedAt) : null,
    inRange: cutoff === 0 || (completedAt ?? 0) >= cutoff,
    stored: {
      score: session.score,
      correctCount: session.correctCount,
      timeTaken: session.timeTaken ?? null,
      activeTimeMs: session.activeTimeMs ?? null,
    },
    recounted: {
      hasQuestions: session.questions !== undefined,
      total,
      answered,
      correct,
      scorePercent: total > 0 ? Math.round((correct * 100) / total) : 0,
      hasCompleteTiming,
      responseTimesMs,
      activeTimeMs,
    },
  };
}

function findAnomalies(fact: SessionFact): Anomaly[] {
  const anomalies: Anomaly[] = [];
  const add = (code: AnomalyCode, detail: string) =>
    anomalies.push({ code, sessionId: fact.sessionId, detail });

  if (!fact.recounted.hasQuestions) {
    add("NO_QUESTIONS_LEGACY", `sessionLength=${fact.recounted.total}`);
  }

  if (fact.status !== "completed") {
    return anomalies;
  }

  const { stored, recounted } = fact;

  if (!Number.isFinite(stored.score) || stored.score < 0 || stored.score > 100) {
    add("SCORE_OUT_OF_RANGE", `stored score=${stored.score}`);
  }
  if (recounted.hasQuestions && stored.score !== recounted.scorePercent) {
    add("SCORE_MISMATCH", `stored=${stored.score} derived=${recounted.scorePercent}`);
  }
  if (recounted.hasQuestions && stored.correctCount !== recounted.correct) {
    add("CORRECT_COUNT_MISMATCH", `stored=${stored.correctCount} recount=${recounted.correct}`);
  }
  if (recounted.hasQuestions && recounted.answered < recounted.total) {
    add("COMPLETED_WITH_UNANSWERED", `answered=${recounted.answered}/${recounted.total}`);
  }
  if (fact.completedAt === null) {
    add("MISSING_COMPLETED_AT", "completed session has no completedAt");
  }
  if (stored.timeTaken === null) {
    add("MISSING_TIME_TAKEN", "completed session has no timeTaken");
  } else if (stored.timeTaken > recounted.total * AUDIT_RESPONSE_TIME_CAP_MS) {
    add(
      "DURATION_EXCEEDS_CAP",
      `timeTaken=${stored.timeTaken}ms > ${recounted.total} x ${AUDIT_RESPONSE_TIME_CAP_MS}ms`
    );
  }
  if (stored.activeTimeMs !== null && stored.activeTimeMs !== recounted.activeTimeMs) {
    add(
      "ACTIVE_TIME_CACHE_MISMATCH",
      `stored=${stored.activeTimeMs} recomputed=${recounted.activeTimeMs}`
    );
  }

  return anomalies;
}

export const auditUserSessionStats = internalQuery({
  args: {
    clerkId: v.string(),
    dateRange: v.optional(v.union(v.literal("7d"), v.literal("30d"), v.literal("all"))),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();
    if (!user) {
      return { error: `No user with clerkId ${args.clerkId}` };
    }

    const now = Date.now();
    const dateRange: AuditDateRange = args.dateRange ?? "all";
    const cutoff =
      dateRange === "all" ? 0 : now - (dateRange === "7d" ? 7 : 30) * DAY_MS;

    const rows = await ctx.db
      .query("practiceSessions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    rows.sort((a, b) => b.startedAt - a.startedAt);

    const facts = rows.map((row) => buildFact(row, cutoff));
    const anomalies = facts.flatMap(findAnomalies);

    const completedAll = facts.filter((fact) => fact.status === "completed");
    const completed = completedAll.filter((fact) => fact.inRange);
    const completedRows = rows.filter(
      (row) => row.status === "completed" && (cutoff === 0 || (row.completedAt ?? 0) >= cutoff)
    );

    // Scores (session-weighted).
    const percents = completed.map((fact) => fact.recounted.scorePercent);
    let percentSum = 0;
    for (const p of percents) percentSum += p;
    const averageScore = percents.length > 0 ? Math.round(percentSum / percents.length) : 0;
    let bestScore = 0;
    let worstScore = 0;
    if (percents.length > 0) {
      bestScore = percents[0];
      worstScore = percents[0];
      for (const p of percents) {
        if (p > bestScore) bestScore = p;
        if (p < worstScore) worstScore = p;
      }
    }

    // Accuracy by mode (question-weighted).
    const modeTotals = {
      learn: { sessions: 0, correct: 0, answered: 0 },
      match: { sessions: 0, correct: 0, answered: 0 },
    };
    for (const fact of completed) {
      const bucket = modeTotals[fact.mode];
      bucket.sessions += 1;
      bucket.correct += fact.recounted.correct;
      bucket.answered += fact.recounted.answered;
    }
    const accuracyByMode = {
      learn: {
        ...modeTotals.learn,
        accuracy:
          modeTotals.learn.answered > 0
            ? Math.round((modeTotals.learn.correct * 100) / modeTotals.learn.answered)
            : 0,
      },
      match: {
        ...modeTotals.match,
        accuracy:
          modeTotals.match.answered > 0
            ? Math.round((modeTotals.match.correct * 100) / modeTotals.match.answered)
            : 0,
      },
    };

    // Per-flag tallies (only sessions with questions carry per-flag data).
    const flagTally = new Map<string, { flagId: Id<"flags">; attempts: number; misses: number }>();
    const distinctFlags = new Set<string>();
    for (const row of completedRows) {
      for (const flagId of row.flagIds) distinctFlags.add(flagId);
      if (!row.questions) continue;
      for (const question of row.questions) {
        const entry = flagTally.get(question.flagId) ?? {
          flagId: question.flagId,
          attempts: 0,
          misses: 0,
        };
        entry.attempts += 1;
        if (question.userAnswer !== question.correctAnswer) entry.misses += 1;
        flagTally.set(question.flagId, entry);
      }
    }

    const flagDocs = new Map<string, Doc<"flags">>();
    for (const entry of flagTally.values()) {
      const flag = await ctx.db.get(entry.flagId);
      if (flag) flagDocs.set(entry.flagId, flag);
    }

    const categoryTotals = new Map<string, { attempts: number; correct: number }>();
    for (const entry of flagTally.values()) {
      const category = flagDocs.get(entry.flagId)?.category ?? "(missing flag)";
      const totals = categoryTotals.get(category) ?? { attempts: 0, correct: 0 };
      totals.attempts += entry.attempts;
      totals.correct += entry.attempts - entry.misses;
      categoryTotals.set(category, totals);
    }
    const accuracyByCategory = [...categoryTotals.entries()]
      .map(([category, totals]) => ({
        category,
        attempts: totals.attempts,
        correct: totals.correct,
        accuracy: totals.attempts > 0 ? Math.round((totals.correct * 100) / totals.attempts) : 0,
      }))
      .sort((a, b) => a.category.localeCompare(b.category));

    const flagsMastered = [...flagTally.values()]
      .filter((entry) => entry.attempts >= 2 && entry.misses === 0)
      .map((entry) => ({
        flagId: entry.flagId,
        flagKey: flagDocs.get(entry.flagId)?.key ?? null,
        attempts: entry.attempts,
      }))
      .sort((a, b) => b.attempts - a.attempts);

    const mostMissed = [...flagTally.values()]
      .filter((entry) => entry.misses > 0)
      .map((entry) => ({
        flagId: entry.flagId,
        flagKey: flagDocs.get(entry.flagId)?.key ?? null,
        attempts: entry.attempts,
        misses: entry.misses,
        missRate: Math.round((entry.misses * 100) / entry.attempts),
      }))
      .sort((a, b) =>
        b.misses / b.attempts !== a.misses / a.attempts
          ? b.misses / b.attempts - a.misses / a.attempts
          : b.misses - a.misses
      )
      .slice(0, 5);

    // Time.
    let totalTimePracticedMs = 0;
    const allResponseTimes: number[] = [];
    for (const fact of completed) {
      totalTimePracticedMs += fact.recounted.activeTimeMs;
      allResponseTimes.push(...fact.recounted.responseTimesMs);
    }
    const avgSessionTimeMs =
      completed.length > 0 ? Math.round(totalTimePracticedMs / completed.length) : 0;
    let responseSum = 0;
    for (const ms of allResponseTimes) responseSum += ms;
    const averageResponseTimeMs =
      allResponseTimes.length > 0 ? Math.round(responseSum / allResponseTimes.length) : null;

    // Day streaks: all history, local calendar days of completedAt.
    const activeDays = new Set<number>();
    for (const fact of completedAll) {
      if (fact.localDay) activeDays.add(dayNumber(fact.localDay));
    }
    const today = dayNumber(localDayOf(now));
    let currentDayStreak = 0;
    let cursor = activeDays.has(today) ? today : activeDays.has(today - 1) ? today - 1 : null;
    while (cursor !== null && activeDays.has(cursor)) {
      currentDayStreak += 1;
      cursor -= 1;
    }
    let longestDayStreak = 0;
    for (const day of activeDays) {
      if (day > today || activeDays.has(day - 1)) continue;
      let length = 0;
      while (activeDays.has(day + length) && day + length <= today) length += 1;
      if (length > longestDayStreak) longestDayStreak = length;
    }

    // Weekly frequency (ISO weeks of local completion day).
    const weekCounts = new Map<string, number>();
    for (const fact of completed) {
      if (!fact.localDay) continue;
      const week = isoWeekOf(fact.localDay);
      weekCounts.set(week, (weekCounts.get(week) ?? 0) + 1);
    }
    const weeklyFrequency = [...weekCounts.entries()]
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([week, count]) => ({ week, count }));

    let lastPracticedAt: number | null = null;
    for (const fact of completedAll) {
      if (fact.completedAt !== null && (lastPracticedAt === null || fact.completedAt > lastPracticedAt)) {
        lastPracticedAt = fact.completedAt;
      }
    }

    const anomalyCounts: Record<string, number> = {};
    for (const anomaly of anomalies) {
      anomalyCounts[anomaly.code] = (anomalyCounts[anomaly.code] ?? 0) + 1;
    }

    return {
      userId: user._id,
      clerkId: args.clerkId,
      generatedAt: now,
      dateRange,
      timeZone: AUDIT_TIME_ZONE,
      todayLocal: localDayOf(now),
      responseTimeCapMs: AUDIT_RESPONSE_TIME_CAP_MS,
      expected: {
        sessionsCompleted: completed.length,
        sessionsCompletedAllTime: completedAll.length,
        sessionsAbandonedAllTime: facts.filter((fact) => fact.status === "abandoned").length,
        sessionsActive: facts.filter((fact) => fact.status === "active").length,
        sessionsStartedAllTime: facts.length,
        averageScore,
        bestScore,
        worstScore,
        accuracyByMode,
        accuracyByCategory,
        totalTimePracticedMs,
        avgSessionTimeMs,
        averageResponseTimeMs,
        currentDayStreak,
        longestDayStreak,
        flagsPracticedDistinct: distinctFlags.size,
        flagsMasteredCount: flagsMastered.length,
        flagsMastered,
        mostMissed,
        weeklyFrequency,
        lastPracticedAt,
      },
      anomalyCounts,
      anomalies,
      sessions: facts,
    };
  },
});
