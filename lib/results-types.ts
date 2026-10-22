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
    /** Empty when flagMissing */
    flagKey: string;
    /** "Unknown flag" when flagMissing */
    flagName: string;
    flagMeaning: string;
    /** Empty when flagMissing */
    flagImagePath: string;
    flagCategory: string;
    flagType: string;
    /** True when the flag record no longer exists; the question still counts toward totals */
    flagMissing: boolean;
    isCorrect: boolean;
    /** Human-readable label of what the user selected (null if unanswered) */
    userAnswerLabel: string | null;
    /** Human-readable label of the correct answer */
    correctAnswerLabel: string;
    questionType: "learn" | "match";
}

/**
 * Full session result returned by getSessionResults.
 * `score`, `correctCount`, and `totalQuestions` are derived from the answers server-side
 * (docs/session-statistics.md#session-score-percent); never recompute them in the UI.
 */
export interface SessionResult {
    sessionId: string;
    mode: "learn" | "match";
    sessionLength: number;
    /** Integer percent 0–100: round(correctCount / totalQuestions × 100) */
    score: number;
    /** Questions answered correctly, recounted from answers */
    correctCount: number;
    /** questions.length (legacy: sessionLength) */
    totalQuestions: number;
    startedAt: number;
    completedAt: number | null;
    /** Wall-clock elapsed ms (includes idle/resume time); null for sessions before timeTaken was added */
    timeTaken: number | null;
    /** Active practice time in ms: sum of capped response times (docs/session-statistics.md#session-active-time) */
    activeTimeMs: number;
    /** Mean capped response time per flag in ms; null when the session has no timing data */
    averageResponseTimeMs: number | null;
    questions: SessionResultQuestion[];
}

// ---------------------------------------------------------------------------
// Recent Activity
// ---------------------------------------------------------------------------

/**
 * Summary of a recently completed session for the dashboard widget.
 * Same derived semantics as {@link SessionResult}.
 */
export interface RecentSession {
    sessionId: string;
    mode: "learn" | "match";
    sessionLength: number;
    /** Integer percent 0–100, derived from answers */
    score: number;
    correctCount: number;
    totalQuestions: number;
    startedAt: number;
    completedAt: number | null;
    timeTaken: number | null;
    /** Active practice time in ms (see {@link SessionResult.activeTimeMs}) */
    activeTimeMs: number;
    averageResponseTimeMs: number | null;
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
    /** Question-weighted accuracy: round(Σ correct / Σ answered × 100) (docs/session-statistics.md#accuracy) */
    successRate: number;
}

/**
 * Full analytics summary returned by getAnalyticsSummary.
 * Formulas: docs/session-statistics.md
 */
export interface AnalyticsSummary {
    /** Completed sessions in range */
    totalSessions: number;
    /** Mean of per-session score percents, rounded once (session-weighted) */
    averageScore: number;
    /** Highest per-session score percent */
    bestScore: number;
    /** Lowest per-session score percent (not currently displayed) */
    worstScore: number;
    /** Total active practice ms: Σ session active time (docs/session-statistics.md#total-time-practiced) */
    totalTimePracticed: number;
    /** Average active session duration in ms */
    avgSessionTime: number;
    /** Mean capped response time per flag in ms; null when no session has timing data */
    averageResponseTimeMs: number | null;
    /** Local-day streaks (America/Toronto) over all history */
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
