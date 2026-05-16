import { Doc } from "../../_generated/dataModel";
import { QueryCtx } from "../../_generated/server";
import { normalizeAdminTimelineTimeZone } from "./activity_timeline";
import { roundToTwoDecimals } from "./time";

type AnalyticsRange = "7d" | "30d" | "90d";
type CohortGroupBy = "role" | "rank";

type FlagCategoryBucket = "letters" | "numbers" | "special";

type Mode = "learn" | "match";

interface TallyBucket {
  attempts: number;
  correct: number;
}

interface CohortTally extends TallyBucket {
  scoreSum: number;
}

interface HistogramBucket {
  key: string;
  label: string;
  minMinutes: number;
  maxMinutes: number | null;
}

interface BuildAnalyticsInput {
  range: AnalyticsRange;
  compareRange: AnalyticsRange;
  groupBy: CohortGroupBy;
  timeZone?: string;
  now?: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

const HISTOGRAM_BUCKETS: HistogramBucket[] = [
  { key: "0-5", label: "0-5 min", minMinutes: 0, maxMinutes: 5 },
  { key: "5-10", label: "5-10 min", minMinutes: 5, maxMinutes: 10 },
  { key: "10-15", label: "10-15 min", minMinutes: 10, maxMinutes: 15 },
  { key: "15-20", label: "15-20 min", minMinutes: 15, maxMinutes: 20 },
  { key: "20-plus", label: "20+ min", minMinutes: 20, maxMinutes: null },
];

const dateFormatterCache = new Map<string, Intl.DateTimeFormat>();

function getDateFormatter(timeZone: string): Intl.DateTimeFormat {
  const cached = dateFormatterCache.get(timeZone);
  if (cached) {
    return cached;
  }

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  dateFormatterCache.set(timeZone, formatter);
  return formatter;
}

function formatDateKey(timestamp: number, timeZone: string): string {
  return getDateFormatter(timeZone).format(new Date(timestamp));
}

function formatTrendLabel(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map((value) => Number(value));
  const date = new Date(Date.UTC(year, month - 1, day));
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function getRangeDays(range: AnalyticsRange): number {
  if (range === "7d") {
    return 7;
  }

  if (range === "30d") {
    return 30;
  }

  return 90;
}

function cutoffFromRange(now: number, range: AnalyticsRange): number {
  const days = getRangeDays(range);
  return now - (days - 1) * DAY_MS;
}

function normalizeCategory(category: string): FlagCategoryBucket {
  const normalized = category.trim().toLowerCase();
  if (normalized.includes("letter")) {
    return "letters";
  }

  if (normalized.includes("number")) {
    return "numbers";
  }

  return "special";
}

function toPassRatePercent(correct: number, attempts: number): number {
  if (attempts === 0) {
    return 0;
  }

  return roundToTwoDecimals((correct / attempts) * 100);
}

function toAverageScorePercent(scoreSum: number, attempts: number): number {
  if (attempts === 0) {
    return 0;
  }

  return roundToTwoDecimals(scoreSum / attempts);
}

function buildTrendDateKeys(now: number, range: AnalyticsRange, timeZone: string): string[] {
  const totalDays = getRangeDays(range);
  const keys: string[] = [];

  for (let index = totalDays - 1; index >= 0; index -= 1) {
    const timestamp = now - index * DAY_MS;
    keys.push(formatDateKey(timestamp, timeZone));
  }

  return keys;
}

function buildRetakeSummary(results: Doc<"examResults">[]) {
  let passed = 0;
  let scoreSum = 0;

  for (const result of results) {
    if (result.passed) {
      passed += 1;
    }
    scoreSum += result.scorePercent;
  }

  const attempts = results.length;
  const failed = attempts - passed;

  return {
    attempts,
    passed,
    failed,
    passRatePercent: toPassRatePercent(passed, attempts),
    averageScorePercent: toAverageScorePercent(scoreSum, attempts),
  };
}

function getDurationMs(result: Doc<"examResults">): number | null {
  const delta = result.completedAt - result.startedAt;
  if (!Number.isFinite(delta) || delta < 0) {
    return null;
  }

  return delta;
}

function getHistogramBucketKey(durationMinutes: number): string {
  for (const bucket of HISTOGRAM_BUCKETS) {
    if (bucket.maxMinutes === null && durationMinutes >= bucket.minMinutes) {
      return bucket.key;
    }

    if (
      bucket.maxMinutes !== null &&
      durationMinutes >= bucket.minMinutes &&
      durationMinutes < bucket.maxMinutes
    ) {
      return bucket.key;
    }
  }

  return "20-plus";
}

async function getUsersById(
  ctx: QueryCtx,
  userIds: Doc<"users">["_id"][]
): Promise<Map<string, Doc<"users">>> {
  const docs = await Promise.all(userIds.map((userId) => ctx.db.get(userId)));
  const map = new Map<string, Doc<"users">>();

  for (const doc of docs) {
    if (doc) {
      map.set(doc._id.toString(), doc);
    }
  }

  return map;
}

function cohortGroupFromResult(input: {
  result: Doc<"examResults">;
  groupBy: CohortGroupBy;
  usersById: Map<string, Doc<"users">>;
}): string {
  if (input.groupBy === "role") {
    return input.result.userSnapshot.roleAtExam;
  }

  const user = input.usersById.get(input.result.userId.toString());
  const rank = user?.rank?.trim();
  return rank && rank.length > 0 ? rank : "Unspecified";
}

function buildCohortRows(input: {
  results: Doc<"examResults">[];
  groupBy: CohortGroupBy;
  usersById: Map<string, Doc<"users">>;
}) {
  const tally = new Map<string, CohortTally>();

  for (const result of input.results) {
    const group = cohortGroupFromResult({
      result,
      groupBy: input.groupBy,
      usersById: input.usersById,
    });

    const bucket = tally.get(group) ?? { attempts: 0, correct: 0, scoreSum: 0 };
    bucket.attempts += 1;
    if (result.passed) {
      bucket.correct += 1;
    }
    bucket.scoreSum += result.scorePercent;
    tally.set(group, bucket);
  }

  return [...tally.entries()]
    .map(([group, bucket]) => ({
      group,
      attempts: bucket.attempts,
      passed: bucket.correct,
      failed: bucket.attempts - bucket.correct,
      passRatePercent: toPassRatePercent(bucket.correct, bucket.attempts),
      averageScorePercent: toAverageScorePercent(bucket.scoreSum, bucket.attempts),
    }))
    .sort((a, b) => {
      if (b.attempts !== a.attempts) {
        return b.attempts - a.attempts;
      }
      return a.group.localeCompare(b.group);
    });
}

export async function buildAdminPerformanceAnalytics(
  ctx: QueryCtx,
  input: BuildAnalyticsInput
) {
  const now = input.now ?? Date.now();
  const timeZone = normalizeAdminTimelineTimeZone(input.timeZone);
  const widestRange: AnalyticsRange =
    getRangeDays(input.range) >= getRangeDays(input.compareRange)
      ? input.range
      : input.compareRange;

  const widestCutoff = cutoffFromRange(now, widestRange);
  const currentCutoff = cutoffFromRange(now, input.range);
  const comparisonCutoff = cutoffFromRange(now, input.compareRange);

  const windowResults = await ctx.db
    .query("examResults")
    .withIndex("by_completedAt", (q) => q.gte("completedAt", widestCutoff))
    .collect();

  const currentResults = windowResults.filter((result) => result.completedAt >= currentCutoff);
  const comparisonResults = windowResults.filter(
    (result) => result.completedAt >= comparisonCutoff
  );

  const categoryTally = new Map<FlagCategoryBucket, TallyBucket>([
    ["letters", { attempts: 0, correct: 0 }],
    ["numbers", { attempts: 0, correct: 0 }],
    ["special", { attempts: 0, correct: 0 }],
  ]);

  const flagTally = new Map<string, TallyBucket & { flagKey: string; flagName: string }>();
  const questionTally = new Map<
    string,
    TallyBucket & { questionKey: string; flagKey: string; flagName: string; mode: Mode }
  >();

  const trendTally = new Map<
    string,
    { attempts: number; passed: number; scoreSum: number }
  >();

  const completionHistogramTally = new Map<string, number>(
    HISTOGRAM_BUCKETS.map((bucket) => [bucket.key, 0])
  );

  for (const result of currentResults) {
    for (const question of result.questionBreakdown) {
      const category = normalizeCategory(question.category);
      const categoryBucket = categoryTally.get(category)!;
      categoryBucket.attempts += 1;
      if (question.isCorrect) {
        categoryBucket.correct += 1;
      }

      const flagKey = question.flagKey;
      const flagName = question.flagName;
      const flagCompositeKey = `${flagKey}`;
      const flagBucket =
        flagTally.get(flagCompositeKey) ?? {
          flagKey,
          flagName,
          attempts: 0,
          correct: 0,
        };
      flagBucket.attempts += 1;
      if (question.isCorrect) {
        flagBucket.correct += 1;
      }
      flagTally.set(flagCompositeKey, flagBucket);

      const mode = question.mode;
      const questionKey = `${flagKey}:${mode}`;
      const questionBucket =
        questionTally.get(questionKey) ?? {
          questionKey,
          flagKey,
          flagName,
          mode,
          attempts: 0,
          correct: 0,
        };
      questionBucket.attempts += 1;
      if (question.isCorrect) {
        questionBucket.correct += 1;
      }
      questionTally.set(questionKey, questionBucket);
    }

    const trendDateKey = formatDateKey(result.completedAt, timeZone);
    const trendBucket = trendTally.get(trendDateKey) ?? {
      attempts: 0,
      passed: 0,
      scoreSum: 0,
    };

    trendBucket.attempts += 1;
    trendBucket.scoreSum += result.scorePercent;
    if (result.passed) {
      trendBucket.passed += 1;
    }
    trendTally.set(trendDateKey, trendBucket);

    const durationMs = getDurationMs(result);
    if (durationMs !== null) {
      const durationMinutes = durationMs / 1000 / 60;
      const bucketKey = getHistogramBucketKey(durationMinutes);
      completionHistogramTally.set(
        bucketKey,
        (completionHistogramTally.get(bucketKey) ?? 0) + 1
      );
    }
  }

  const trendDateKeys = buildTrendDateKeys(now, input.range, timeZone);

  const firstAttempts = currentResults.filter((result) => result.attemptNumber === 1);
  const retakes = currentResults.filter((result) => result.attemptNumber > 1);

  const comparisonUserIds = new Set<Doc<"users">["_id"]>();
  for (const result of comparisonResults) {
    comparisonUserIds.add(result.userId);
  }

  const usersById =
    input.groupBy === "rank"
      ? await getUsersById(ctx, [...comparisonUserIds])
      : new Map<string, Doc<"users">>();

  return {
    range: input.range,
    compareRange: input.compareRange,
    timeZone,
    generatedAt: now,
    categoryPerformance: [...categoryTally.entries()].map(([category, bucket]) => ({
      category,
      attempts: bucket.attempts,
      correct: bucket.correct,
      passRatePercent: toPassRatePercent(bucket.correct, bucket.attempts),
    })),
    bottomFlags: [...flagTally.values()]
      .map((bucket) => ({
        flagKey: bucket.flagKey,
        flagName: bucket.flagName,
        attempts: bucket.attempts,
        correct: bucket.correct,
        passRatePercent: toPassRatePercent(bucket.correct, bucket.attempts),
      }))
      .filter((row) => row.attempts > 0)
      .sort((a, b) => {
        if (a.passRatePercent !== b.passRatePercent) {
          return a.passRatePercent - b.passRatePercent;
        }
        if (b.attempts !== a.attempts) {
          return b.attempts - a.attempts;
        }
        return a.flagName.localeCompare(b.flagName);
      })
      .slice(0, 10),
    questionDifficulty: [...questionTally.values()]
      .map((bucket) => ({
        questionKey: bucket.questionKey,
        flagKey: bucket.flagKey,
        flagName: bucket.flagName,
        mode: bucket.mode,
        attempts: bucket.attempts,
        correct: bucket.correct,
        passRatePercent: toPassRatePercent(bucket.correct, bucket.attempts),
      }))
      .filter((row) => row.attempts > 0)
      .sort((a, b) => {
        if (a.passRatePercent !== b.passRatePercent) {
          return a.passRatePercent - b.passRatePercent;
        }
        if (b.attempts !== a.attempts) {
          return b.attempts - a.attempts;
        }
        return a.questionKey.localeCompare(b.questionKey);
      }),
    trend: trendDateKeys.map((dateKey) => {
      const bucket = trendTally.get(dateKey) ?? {
        attempts: 0,
        passed: 0,
        scoreSum: 0,
      };

      return {
        dateKey,
        label: formatTrendLabel(dateKey),
        attempts: bucket.attempts,
        passRatePercent: toPassRatePercent(bucket.passed, bucket.attempts),
        averageScorePercent: toAverageScorePercent(bucket.scoreSum, bucket.attempts),
      };
    }),
    completionHistogram: HISTOGRAM_BUCKETS.map((bucket) => ({
      bucketKey: bucket.key,
      label: bucket.label,
      minMinutes: bucket.minMinutes,
      maxMinutes: bucket.maxMinutes,
      count: completionHistogramTally.get(bucket.key) ?? 0,
    })),
    retakeComparison: {
      firstAttempt: buildRetakeSummary(firstAttempts),
      retakes: buildRetakeSummary(retakes),
    },
    cohortComparison: {
      groupBy: input.groupBy,
      current: {
        range: input.range,
        rows: buildCohortRows({
          results: currentResults,
          groupBy: input.groupBy,
          usersById,
        }),
      },
      comparison: {
        range: input.compareRange,
        rows: buildCohortRows({
          results: comparisonResults,
          groupBy: input.groupBy,
          usersById,
        }),
      },
    },
  };
}
