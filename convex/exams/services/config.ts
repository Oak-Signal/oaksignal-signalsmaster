const MIN_OFFICIAL_EXAM_IDLE_TIMEOUT_MS = 60_000;
const DEFAULT_OFFICIAL_EXAM_SUBMISSION_MIN_INTERVAL_MS = 750;
const DEFAULT_OFFICIAL_EXAM_SUBMISSION_WINDOW_MS = 60_000;
const DEFAULT_OFFICIAL_EXAM_SUBMISSION_MAX_PER_WINDOW = 30;
const DEFAULT_OFFICIAL_EXAM_MIN_RESPONSE_TIME_MS = 1_500;
const DEFAULT_OFFICIAL_EXAM_SLOW_RESPONSE_WARNING_MS = 120_000;
const DEFAULT_INTEGRITY_MIN_AVERAGE_ANSWER_TIME_MS = 5_000;
const DEFAULT_INTEGRITY_MAX_CONSECUTIVE_SAME_ANSWER = 5;
const DEFAULT_INTEGRITY_MIN_EXPECTED_DURATION_RATIO_PERCENT = 50;
const DEFAULT_INTEGRITY_MIN_ANSWER_TIME_STD_DEV_MS = 1_000;

export interface ExamSubmissionRateLimitConfig {
  minIntervalMs: number;
  windowMs: number;
  maxPerWindow: number;
}

export interface ExamTimingAnomalyConfig {
  minResponseTimeMs: number;
  slowResponseWarningMs: number;
}

export interface ExamIntegrityThresholdsConfig {
  minAverageAnswerTimeMs: number;
  maxConsecutiveSameAnswer: number;
  minExpectedDurationRatioPercent: number;
  minAnswerTimeStdDevMs: number;
}

function getPositiveIntegerEnv(
  envKey: string,
  fallback: number,
  minimum: number
): number {
  const raw = process.env[envKey]?.trim();
  if (!raw) {
    return fallback;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
    throw new Error(`${envKey} must be an integer.`);
  }

  if (parsed < minimum) {
    throw new Error(`${envKey} must be at least ${minimum}.`);
  }

  return parsed;
}

export function getOfficialExamSubmissionRateLimitConfig(): ExamSubmissionRateLimitConfig {
  return {
    minIntervalMs: getPositiveIntegerEnv(
      "OFFICIAL_EXAM_SUBMISSION_MIN_INTERVAL_MS",
      DEFAULT_OFFICIAL_EXAM_SUBMISSION_MIN_INTERVAL_MS,
      100
    ),
    windowMs: getPositiveIntegerEnv(
      "OFFICIAL_EXAM_SUBMISSION_WINDOW_MS",
      DEFAULT_OFFICIAL_EXAM_SUBMISSION_WINDOW_MS,
      1_000
    ),
    maxPerWindow: getPositiveIntegerEnv(
      "OFFICIAL_EXAM_SUBMISSION_MAX_PER_WINDOW",
      DEFAULT_OFFICIAL_EXAM_SUBMISSION_MAX_PER_WINDOW,
      1
    ),
  };
}

export function getOfficialExamTimingAnomalyConfig(): ExamTimingAnomalyConfig {
  return {
    minResponseTimeMs: getPositiveIntegerEnv(
      "OFFICIAL_EXAM_MIN_RESPONSE_TIME_MS",
      DEFAULT_OFFICIAL_EXAM_MIN_RESPONSE_TIME_MS,
      100
    ),
    slowResponseWarningMs: getPositiveIntegerEnv(
      "OFFICIAL_EXAM_SLOW_RESPONSE_WARNING_MS",
      DEFAULT_OFFICIAL_EXAM_SLOW_RESPONSE_WARNING_MS,
      5_000
    ),
  };
}

export function getDefaultExamIntegrityThresholdsConfig(): ExamIntegrityThresholdsConfig {
  const minExpectedDurationRatioPercent = getPositiveIntegerEnv(
    "OFFICIAL_EXAM_INTEGRITY_MIN_EXPECTED_DURATION_RATIO_PERCENT",
    DEFAULT_INTEGRITY_MIN_EXPECTED_DURATION_RATIO_PERCENT,
    1
  );

  if (minExpectedDurationRatioPercent > 100) {
    throw new Error("OFFICIAL_EXAM_INTEGRITY_MIN_EXPECTED_DURATION_RATIO_PERCENT must be <= 100.");
  }

  return {
    minAverageAnswerTimeMs: getPositiveIntegerEnv(
      "OFFICIAL_EXAM_INTEGRITY_MIN_AVERAGE_ANSWER_TIME_MS",
      DEFAULT_INTEGRITY_MIN_AVERAGE_ANSWER_TIME_MS,
      100
    ),
    maxConsecutiveSameAnswer: getPositiveIntegerEnv(
      "OFFICIAL_EXAM_INTEGRITY_MAX_CONSECUTIVE_SAME_ANSWER",
      DEFAULT_INTEGRITY_MAX_CONSECUTIVE_SAME_ANSWER,
      2
    ),
    minExpectedDurationRatioPercent,
    minAnswerTimeStdDevMs: getPositiveIntegerEnv(
      "OFFICIAL_EXAM_INTEGRITY_MIN_ANSWER_TIME_STD_DEV_MS",
      DEFAULT_INTEGRITY_MIN_ANSWER_TIME_STD_DEV_MS,
      100
    ),
  };
}

export function getOfficialExamIdleTimeoutMs(): number | null {
  const raw = process.env.OFFICIAL_EXAM_IDLE_TIMEOUT_MS?.trim();
  if (!raw) {
    return null;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
    throw new Error("OFFICIAL_EXAM_IDLE_TIMEOUT_MS must be an integer number of milliseconds.");
  }

  if (parsed < MIN_OFFICIAL_EXAM_IDLE_TIMEOUT_MS) {
    throw new Error(
      `OFFICIAL_EXAM_IDLE_TIMEOUT_MS must be at least ${MIN_OFFICIAL_EXAM_IDLE_TIMEOUT_MS}.`
    );
  }

  return parsed;
}
