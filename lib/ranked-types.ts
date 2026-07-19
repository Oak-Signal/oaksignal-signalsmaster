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
