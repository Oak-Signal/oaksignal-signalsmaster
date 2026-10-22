/**
 * Canonical practice-session statistics.
 *
 * Every statistic derived from `practiceSessions` MUST be computed with these pure functions so
 * all surfaces (dashboard, analytics, practice page, results, admin profile) agree. Formulas are
 * specified in docs/session-statistics.md; update both together.
 *
 * Pure module: no Convex `ctx`, no database access.
 */

/** @see docs/session-statistics.md#constants */
export const STATS_TIME_ZONE = "America/Toronto";

/** @see docs/session-statistics.md#constants */
export const RESPONSE_TIME_CAP_MS = 60_000;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Minimal question shape needed for statistics (structurally compatible with the schema). */
export interface StatsQuestion {
  userAnswer: string | null;
  correctAnswer: string;
  answeredAt?: number;
}

/** Minimal session shape needed for statistics (structurally compatible with the schema). */
export interface StatsSession {
  questions?: readonly StatsQuestion[];
  correctCount: number;
  sessionLength: number;
  startedAt: number;
  timeTaken?: number;
}

export interface DayStreaks {
  current: number;
  longest: number;
}

export interface FlagAttemptTally {
  attempts: number;
  misses: number;
}

function isAnswered(question: StatsQuestion): boolean {
  return question.userAnswer !== null;
}

function isCorrect(question: StatsQuestion): boolean {
  return question.userAnswer !== null && question.userAnswer === question.correctAnswer;
}

/**
 * Number of correctly answered questions, recounted from raw answers.
 * Legacy sessions without `questions` fall back to the stored `correctCount`, clamped to
 * `[0, sessionLength]`.
 *
 * @see docs/session-statistics.md#session-correct-count
 */
export function deriveSessionCorrectCount(session: StatsSession): number {
  if (session.questions !== undefined) {
    return session.questions.filter(isCorrect).length;
  }

  const total = Math.max(0, session.sessionLength);
  const stored = Number.isFinite(session.correctCount) ? session.correctCount : 0;
  return Math.min(total, Math.max(0, Math.trunc(stored)));
}

/**
 * Number of questions in the session: `questions.length`, or `sessionLength` for legacy rows.
 *
 * @see docs/session-statistics.md#session-total-questions
 */
export function deriveSessionTotalQuestions(session: StatsSession): number {
  if (session.questions !== undefined) {
    return session.questions.length;
  }

  return Math.max(0, session.sessionLength);
}

/**
 * Number of answered questions (`userAnswer !== null`). Legacy rows are treated as fully answered.
 *
 * @see docs/session-statistics.md#accuracy
 */
export function deriveSessionAnsweredCount(session: StatsSession): number {
  if (session.questions !== undefined) {
    return session.questions.filter(isAnswered).length;
  }

  return deriveSessionTotalQuestions(session);
}

/**
 * Session score percent: `round(correct / total × 100)`; `0` when `total = 0`.
 * Never reads the stored `score` field.
 *
 * @see docs/session-statistics.md#session-score-percent
 */
export function deriveSessionScorePercent(session: StatsSession): number {
  const total = deriveSessionTotalQuestions(session);
  if (total === 0) {
    return 0;
  }

  return Math.round((deriveSessionCorrectCount(session) / total) * 100);
}

/**
 * Mean of per-session score percents, rounded once; `0` for no sessions.
 *
 * @see docs/session-statistics.md#average-score
 */
export function computeAverageScore(percents: readonly number[]): number {
  if (percents.length === 0) {
    return 0;
  }

  const sum = percents.reduce((total, value) => total + value, 0);
  return Math.round(sum / percents.length);
}

/**
 * Highest per-session score percent; `0` for no sessions.
 *
 * @see docs/session-statistics.md#best-score
 */
export function computeBestScore(percents: readonly number[]): number {
  return percents.length === 0 ? 0 : Math.max(...percents);
}

/**
 * Lowest per-session score percent; `0` for no sessions.
 *
 * @see docs/session-statistics.md#worst-score
 */
export function computeWorstScore(percents: readonly number[]): number {
  return percents.length === 0 ? 0 : Math.min(...percents);
}

/**
 * Question-weighted accuracy: `round(correct / answered × 100)`; `0` when nothing was answered.
 *
 * @see docs/session-statistics.md#accuracy
 */
export function computeAccuracy(correct: number, answered: number): number {
  if (answered <= 0) {
    return 0;
  }

  return Math.round((correct / answered) * 100);
}

const dayKeyFormatters = new Map<string, Intl.DateTimeFormat>();

function getDayKeyFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = dayKeyFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    dayKeyFormatters.set(timeZone, formatter);
  }

  return formatter;
}

/**
 * Local calendar day (`YYYY-MM-DD`) of a timestamp in {@link STATS_TIME_ZONE}.
 *
 * @see docs/session-statistics.md#current-day-streak
 */
export function toLocalDayKey(timestamp: number, timeZone: string = STATS_TIME_ZONE): string {
  const parts = getDayKeyFormatter(timeZone).formatToParts(new Date(timestamp));
  const part = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((entry) => entry.type === type)?.value ?? "";

  return `${part("year")}-${part("month")}-${part("day")}`;
}

/** Days since the Unix epoch for a `YYYY-MM-DD` key, using calendar (not 24 h) arithmetic. */
function dayKeyToOrdinal(dayKey: string): number {
  const [year, month, day] = dayKey.split("-").map(Number);
  return Math.round(Date.UTC(year, month - 1, day) / MS_PER_DAY);
}

/**
 * Current and longest runs of consecutive local calendar days with activity.
 * The current streak is alive only if the latest active day is `todayKey` or the day before.
 * Day keys after `todayKey` are ignored.
 *
 * @see docs/session-statistics.md#current-day-streak
 * @see docs/session-statistics.md#longest-day-streak
 */
export function computeDayStreaks(dayKeys: Iterable<string>, todayKey: string): DayStreaks {
  const today = dayKeyToOrdinal(todayKey);
  const ordinals = Array.from(new Set(Array.from(dayKeys, dayKeyToOrdinal)))
    .filter((ordinal) => ordinal <= today)
    .sort((a, b) => a - b);

  if (ordinals.length === 0) {
    return { current: 0, longest: 0 };
  }

  let longest = 1;
  let run = 1;
  for (let i = 1; i < ordinals.length; i++) {
    run = ordinals[i] - ordinals[i - 1] === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
  }

  const lastOrdinal = ordinals[ordinals.length - 1];
  const current = today - lastOrdinal <= 1 ? run : 0;

  return { current, longest };
}

/**
 * Day streaks for a set of completed sessions: local day keys of `completedAt` (sessions without
 * `completedAt` are skipped), measured against the local day of `now`. Callers pass completed
 * sessions from **all history**; streaks ignore date-range filters.
 *
 * @see docs/session-statistics.md#current-day-streak
 * @see docs/session-statistics.md#longest-day-streak
 */
export function computeSessionDayStreaks(
  completedSessions: readonly { completedAt?: number }[],
  now: number
): DayStreaks {
  const dayKeys = completedSessions.flatMap((session) =>
    session.completedAt === undefined ? [] : [toLocalDayKey(session.completedAt)]
  );

  return computeDayStreaks(dayKeys, toLocalDayKey(now));
}

/**
 * True when every answered question carries a server `answeredAt` timestamp and at least one
 * question was answered.
 *
 * @see docs/session-statistics.md#response-time
 */
export function hasCompleteTiming(session: StatsSession): boolean {
  const answered = (session.questions ?? []).filter(isAnswered);
  return (
    answered.length > 0 && answered.every((question) => typeof question.answeredAt === "number")
  );
}

/**
 * Per-question response times in answer order:
 * `min(max(0, answeredAt[i] − (answeredAt[i−1] ?? startedAt)), RESPONSE_TIME_CAP_MS)`.
 * Returns `[]` unless the session has complete timing data.
 *
 * @see docs/session-statistics.md#response-time
 */
export function computeQuestionResponseTimes(session: StatsSession): number[] {
  if (!hasCompleteTiming(session)) {
    return [];
  }

  const answeredAt = (session.questions ?? [])
    .filter(isAnswered)
    .map((question) => question.answeredAt as number)
    .sort((a, b) => a - b);

  const times: number[] = [];
  let previous = session.startedAt;
  for (const timestamp of answeredAt) {
    times.push(Math.min(Math.max(0, timestamp - previous), RESPONSE_TIME_CAP_MS));
    previous = timestamp;
  }

  return times;
}

/**
 * Active practice time: sum of capped response times. Legacy fallback without timing data:
 * `min(timeTaken, totalQuestions × RESPONSE_TIME_CAP_MS)`, or `0` if `timeTaken` is missing.
 *
 * @see docs/session-statistics.md#session-active-time
 */
export function computeSessionActiveTimeMs(session: StatsSession): number {
  if (hasCompleteTiming(session)) {
    return computeQuestionResponseTimes(session).reduce((sum, value) => sum + value, 0);
  }

  const elapsed = Math.max(0, session.timeTaken ?? 0);
  return Math.min(elapsed, deriveSessionTotalQuestions(session) * RESPONSE_TIME_CAP_MS);
}

/**
 * Mean capped response time across sessions with complete timing data, rounded to whole ms;
 * `null` when no session has timing data.
 *
 * @see docs/session-statistics.md#average-response-time
 */
export function computeAverageResponseTimeMs(
  sessions: readonly StatsSession[]
): number | null {
  const times = sessions.flatMap(computeQuestionResponseTimes);
  if (times.length === 0) {
    return null;
  }

  return Math.round(times.reduce((sum, value) => sum + value, 0) / times.length);
}

/**
 * A flag is mastered when it was attempted at least twice with no misses.
 *
 * @see docs/session-statistics.md#flags-mastered
 */
export function isFlagMastered(tally: FlagAttemptTally): boolean {
  return tally.attempts >= 2 && tally.misses === 0;
}

/**
 * ISO-8601 week key (`YYYY-Www`, Monday-start) for a local `YYYY-MM-DD` day key.
 *
 * @see docs/session-statistics.md#weekly-frequency
 */
export function toIsoWeekKey(dayKey: string): string {
  const [year, month, day] = dayKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const isoWeekday = date.getUTCDay() || 7;
  // Shift to the Thursday of this ISO week; its calendar year is the ISO week-year.
  date.setUTCDate(date.getUTCDate() + 4 - isoWeekday);
  const weekYear = date.getUTCFullYear();
  const yearStart = Date.UTC(weekYear, 0, 1);
  const week = Math.ceil(((date.getTime() - yearStart) / MS_PER_DAY + 1) / 7);

  return `${weekYear}-W${String(week).padStart(2, "0")}`;
}
