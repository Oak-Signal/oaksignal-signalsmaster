export const OFFICIAL_EXAM_PASS_THRESHOLD_PERCENT = 80;
export const OFFICIAL_EXAM_IS_UNTIMED = true;
export const OFFICIAL_EXAM_TIME_LIMIT_MINUTES: number | undefined = undefined;
export const OFFICIAL_EXAM_SINGLE_ATTEMPT_ONLY = true;
export const OFFICIAL_EXAM_NO_PAUSE_RESUME = true;
export const OFFICIAL_EXAM_NO_BACKTRACKING = true;
export const OFFICIAL_EXAM_REQUIRES_ALL_ANSWERS = true;

export const OFFICIAL_EXAM_MIN_PRACTICE_SESSIONS = 3;
export const OFFICIAL_EXAM_MIN_RULES_VIEW_DURATION_MS = 20000;

export const OFFICIAL_EXAM_ESTIMATED_SECONDS_PER_QUESTION = 45;

export const SUPPORTED_BROWSERS = ["Chrome", "Edge"] as const;

export interface ExamPolicySnapshot {
  passThresholdPercent: number;
  totalQuestions: number;
  isUntimed: boolean;
  timeLimitMinutes?: number;
  singleAttemptOnly: boolean;
  noPauseResume: boolean;
  noBacktracking: boolean;
  requiresAllAnswers: boolean;
}

export function buildExamPolicySnapshot(totalQuestions: number): ExamPolicySnapshot {
  return {
    passThresholdPercent: OFFICIAL_EXAM_PASS_THRESHOLD_PERCENT,
    totalQuestions,
    isUntimed: OFFICIAL_EXAM_IS_UNTIMED,
    timeLimitMinutes: OFFICIAL_EXAM_TIME_LIMIT_MINUTES,
    singleAttemptOnly: OFFICIAL_EXAM_SINGLE_ATTEMPT_ONLY,
    noPauseResume: OFFICIAL_EXAM_NO_PAUSE_RESUME,
    noBacktracking: OFFICIAL_EXAM_NO_BACKTRACKING,
    requiresAllAnswers: OFFICIAL_EXAM_REQUIRES_ALL_ANSWERS,
  };
}

export function estimateExamDurationMinutes(totalQuestions: number): number {
  if (totalQuestions <= 0) {
    return 0;
  }

  const totalSeconds = totalQuestions * OFFICIAL_EXAM_ESTIMATED_SECONDS_PER_QUESTION;
  return Math.max(1, Math.round(totalSeconds / 60));
}
