export type AdminAnalyticsRange = "7d" | "30d" | "90d";

export type AdminAnalyticsCohortGroupBy = "role" | "rank";

export interface AdminFlagCategoryPerformanceRow {
  category: "letters" | "numbers" | "special";
  attempts: number;
  correct: number;
  passRatePercent: number;
}

export interface AdminBottomFlagRow {
  flagKey: string;
  flagName: string;
  attempts: number;
  correct: number;
  passRatePercent: number;
}

export interface AdminQuestionDifficultyRow {
  questionKey: string;
  flagKey: string;
  flagName: string;
  mode: "learn" | "match";
  attempts: number;
  correct: number;
  passRatePercent: number;
}

export interface AdminTrendPoint {
  dateKey: string;
  label: string;
  attempts: number;
  passRatePercent: number;
  averageScorePercent: number;
}

export interface AdminCompletionHistogramBucket {
  bucketKey: string;
  label: string;
  minMinutes: number;
  maxMinutes: number | null;
  count: number;
}

export interface AdminRetakeSummary {
  attempts: number;
  passed: number;
  failed: number;
  passRatePercent: number;
  averageScorePercent: number;
}

export interface AdminRetakeComparison {
  firstAttempt: AdminRetakeSummary;
  retakes: AdminRetakeSummary;
}

export interface AdminCohortRow {
  group: string;
  attempts: number;
  passed: number;
  failed: number;
  passRatePercent: number;
  averageScorePercent: number;
}

export interface AdminCohortComparisonSegment {
  range: AdminAnalyticsRange;
  rows: AdminCohortRow[];
}

export interface AdminCohortComparison {
  groupBy: AdminAnalyticsCohortGroupBy;
  current: AdminCohortComparisonSegment;
  comparison: AdminCohortComparisonSegment;
}

export interface AdminPerformanceAnalyticsPayload {
  range: AdminAnalyticsRange;
  compareRange: AdminAnalyticsRange;
  timeZone: string;
  generatedAt: number;
  categoryPerformance: AdminFlagCategoryPerformanceRow[];
  bottomFlags: AdminBottomFlagRow[];
  questionDifficulty: AdminQuestionDifficultyRow[];
  trend: AdminTrendPoint[];
  completionHistogram: AdminCompletionHistogramBucket[];
  retakeComparison: AdminRetakeComparison;
  cohortComparison: AdminCohortComparison;
}
