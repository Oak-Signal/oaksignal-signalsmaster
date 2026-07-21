export interface RankedSeasonInfo {
  seasonId: string;
  slug: string;
  name: string;
  startsAt: number;
  endsAt: number | null;
  status: "upcoming" | "active" | "completed" | "archived";
}

export interface RankedCurrentRank {
  isRanked: boolean;
  currentRankTitle: string;
  badge: string;
  accent: string;
  leaderboardPosition: number | null;
  leaderboardTotalPlayers: number;
}

export interface RankedPersonalBest {
  score: number | null;
  runDurationMs: number | null;
  accuracyPercent: number | null;
  flagCount: number | null;
}

export interface RankedNextPromotion {
  targetPosition: number | null;
  pointsRequired: number | null;
  label: string;
}

export interface RankedEntryRequirements {
  requiresPassedFormalExam: boolean;
  hasPassedFormalExam: boolean;
  unmetRequirements: string[];
}

export interface RankedAttemptPolicy {
  canStart: boolean;
  reasons: string[];
  nextAllowedAt: number | null;
  isInCooldown: boolean;
  attemptsToday: number;
  attemptsThisWeek: number;
  dailyAttemptLimit: number | null;
  weeklyAttemptLimit: number | null;
  dailyRemaining: number | null;
  weeklyRemaining: number | null;
}

export interface RankedRunOverview {
  flagCount: number;
  estimatedDurationMs: number;
}

export interface RankedLeaderboardPreviewItem {
  position: number;
  userId: string;
  name: string;
  score: number;
  runDurationMs: number;
  accuracyPercent: number;
  rankTitle: string;
  rankBadge: string;
  rankAccent: string;
}

export interface RankedRecentHistoryItem {
  runId: string;
  status: "started" | "completed" | "abandoned" | "flagged";
  score: number;
  runDurationMs: number | null;
  accuracyPercent: number;
  antiCheatStatus: "clear" | "flagged" | "reviewing" | "disqualified";
  reviewStatus: "none" | "pending" | "confirmed" | "dismissed";
  startedAt: number;
  completedAt: number | null;
}

export interface RankedEntryContext {
  generatedAt: number;
  season: RankedSeasonInfo | null;
  rank: RankedCurrentRank;
  personalBest: RankedPersonalBest;
  nextPromotion: RankedNextPromotion;
  entryRequirements: RankedEntryRequirements;
  attemptPolicy: RankedAttemptPolicy;
  canEnterRankedMode: boolean;
  runOverview: RankedRunOverview;
  rules: {
    items: readonly string[];
  };
  leaderboardPreview: RankedLeaderboardPreviewItem[];
  recentHistory: RankedRecentHistoryItem[];
}

export interface RankedRunState {
  runId: string;
  status: "started" | "completed" | "abandoned" | "flagged";
  startedAt: number;
  completedAt: number | null;
  finalizedAt: number | null;
  immutableAt: number | null;
  runDurationMs: number | null;
  totalElapsedMs: number | null;
  flagCount: number;
  correctCount: number;
  accuracyPercent: number;
  score: number;
  pointsFromTime: number;
  pointsFromAccuracy: number;
  antiCheatStatus: "clear" | "flagged" | "reviewing" | "disqualified";
  reviewStatus: "none" | "pending" | "confirmed" | "dismissed";
  suspiciousReason: string | null;
  suspiciousFlags: string[];
  runChecksum: string | null;
  replayFingerprintHash: string | null;
  signatureVersion: string | null;
  signatureIssuedAt: number | null;
  hasSignedResult: boolean;
}

export interface RankedCompletionResult {
  runId: string;
  status: "completed";
  score: number;
  accuracyPercent: number;
  runDurationMs: number;
  antiCheatStatus: "clear" | "flagged";
  resultToken: string;
  signatureVersion: string;
  signatureIssuedAt: number;
}

// --- Phase 2 (T005) shared types: leaderboard, fleet rank, review status, results view ---

/** Anti-cheat lifecycle state (mirrors `rankedRuns.antiCheatStatus`). */
export type RankedAntiCheatStatus =
  | "clear"
  | "flagged"
  | "reviewing"
  | "disqualified";

/**
 * Admin review workflow state (mirrors `rankedRuns.reviewStatus`).
 * The existing enum is retained; the US7 workflow maps onto these values:
 * `none` (not flagged) → `pending` (awaiting review) → `confirmed` (upheld/invalidated)
 * or `dismissed` (cleared). A `confirmed` run is excluded from standings.
 */
export type RankedReviewStatus = "none" | "pending" | "confirmed" | "dismissed";

/** Display metadata for a fleet rank tier (mirrors `FLEET_RANKS` entries). */
export interface RankedFleetRank {
  title: string;
  badge: string;
  accent: string;
  minPosition: number;
  maxPosition: number;
}

/** A single leaderboard row for the season leaderboard panel (US4). */
export interface RankedLeaderboardEntry {
  position: number;
  userId: string;
  name: string;
  score: number;
  runDurationMs: number;
  accuracyPercent: number;
  completedAt: number;
  fleetRank: RankedFleetRank;
  /** True for the entry belonging to the requesting cadet (self-highlight). */
  isCurrentUser: boolean;
}

/** The full leaderboard view returned to the panel (US4). */
export interface RankedLeaderboardView {
  season: RankedSeasonInfo | null;
  entries: RankedLeaderboardEntry[];
  totalPlayers: number;
  generatedAt: number;
}

/** Rank change communicated after a finalized run (US5/US6). */
export interface RankedRankChange {
  previousPosition: number | null;
  currentPosition: number | null;
  positionDelta: number | null;
  previousRankTitle: string | null;
  currentRankTitle: string;
  direction: "up" | "down" | "same" | "new";
}

/** Per-question breakdown row for the ranked results screen (US6). */
export interface RankedResultQuestion {
  questionIndex: number;
  flagId: string;
  flagKey: string;
  flagName: string;
  flagImagePath: string | null;
  mode: "learn" | "match";
  correctAnswer: string;
  userAnswer: string | null;
  isCorrect: boolean;
  responseTimeMs: number | null;
}

/** Aggregated results view for the rebuilt ranked results client (US6). */
export interface RankedResultsView {
  runId: string;
  score: number;
  accuracyPercent: number;
  correctCount: number;
  flagCount: number;
  runDurationMs: number;
  pointsFromAccuracy: number;
  pointsFromTime: number;
  antiCheatStatus: RankedAntiCheatStatus;
  reviewStatus: RankedReviewStatus;
  hasSignedResult: boolean;
  signatureVersion: string | null;
  rankChange: RankedRankChange | null;
  questions: RankedResultQuestion[];
}
