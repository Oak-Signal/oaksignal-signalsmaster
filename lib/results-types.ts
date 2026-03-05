/**
 * Shared TypeScript interfaces for the Results & Analytics feature.
 * These types mirror the shapes returned by convex/analytics.ts queries
 * and are consumed by all results and analytics UI components.
 */

// ---------------------------------------------------------------------------
// Session Results
// ---------------------------------------------------------------------------

/** One enriched question row on the results page */
export interface SessionResultQuestion {
    flagId: string;
    flagKey: string;
    flagName: string;
    flagMeaning: string;
    flagImagePath: string;
    flagCategory: string;
    flagType: string;
    isCorrect: boolean;
    /** Human-readable label of what the user selected (null if unanswered) */
    userAnswerLabel: string | null;
    /** Human-readable label of the correct answer */
    correctAnswerLabel: string;
    questionType: "learn" | "match";
}

/** Full session result returned by getSessionResults */
export interface SessionResult {
    sessionId: string;
    mode: "learn" | "match";
    sessionLength: number;
    score: number;
    correctCount: number;
    totalQuestions: number;
    startedAt: number;
    completedAt: number | null;
    /** Total duration in milliseconds, null for sessions before timeTaken was added */
    timeTaken: number | null;
    questions: SessionResultQuestion[];
}

// ---------------------------------------------------------------------------
// Recent Activity
// ---------------------------------------------------------------------------

/** Summary of a recently completed session for the dashboard widget */
export interface RecentSession {
    sessionId: string;
    mode: "learn" | "match";
    sessionLength: number;
    score: number;
    correctCount: number;
    totalQuestions: number;
    startedAt: number;
    completedAt: number | null;
    timeTaken: number | null;
}

// ---------------------------------------------------------------------------
// Analytics — Performance Trend
// ---------------------------------------------------------------------------

/** One data point in the performance trend line chart */
export interface PerformanceTrendPoint {
    sessionId: string;
    /** Unix timestamp (ms) of session completion */
    date: number;
    /** Score as a percentage 0–100 */
    score: number;
    mode: "learn" | "match";
    sessionLength: number;
}

// ---------------------------------------------------------------------------
// Analytics — Most Missed Flags
// ---------------------------------------------------------------------------

/** A flag that the user frequently answers incorrectly */
export interface MostMissedFlag {
    flagId: string;
    flagKey: string;
    flagName: string;
    flagImagePath: string;
    flagCategory: string;
    attempts: number;
    misses: number;
    /** Miss rate as an integer percentage (0–100) */
    missRate: number;
}

// ---------------------------------------------------------------------------
// Analytics — Summary
// ---------------------------------------------------------------------------

export interface CategoryBreakdown {
    category: string;
    attempts: number;
    correct: number;
    /** Success rate as an integer percentage (0–100) */
    successRate: number;
}

export interface WeeklyFrequency {
    /** ISO week string, e.g. "2026-W07" */
    week: string;
    count: number;
}

export interface MasteryFlag {
    flagId: string;
    flagKey: string;
    flagName: string;
    flagImagePath: string;
    flagCategory: string;
    attempts: number;
}

export interface ModeStats {
    sessions: number;
    successRate: number;
}

/** Full analytics summary returned by getAnalyticsSummary */
export interface AnalyticsSummary {
    totalSessions: number;
    averageScore: number;
    bestScore: number;
    /** Total ms spent practicing */
    totalTimePracticed: number;
    /** Average session duration in ms */
    avgSessionTime: number;
    longestStreak: number;
    currentStreak: number;
    modeBreakdown: {
        learn: ModeStats;
        match: ModeStats;
    };
    categoryBreakdown: CategoryBreakdown[];
    weeklyFrequency: WeeklyFrequency[];
}

// ---------------------------------------------------------------------------
// Date Range Filter
// ---------------------------------------------------------------------------

export type DateRange = "7d" | "30d" | "all";

export const DATE_RANGE_LABELS: Record<DateRange, string> = {
    "7d": "Last 7 Days",
    "30d": "Last 30 Days",
    all: "All Time",
};
