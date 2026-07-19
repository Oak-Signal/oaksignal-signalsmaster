import {
  RANKED_DEFAULT_CLOCK_DRIFT_WARNING_MS,
  RANKED_DEFAULT_MIN_AVERAGE_ANSWER_TIME_MS,
  RANKED_DEFAULT_MIN_ANSWER_TIME_STD_DEV_MS,
  RANKED_DEFAULT_MIN_RESPONSE_TIME_MS,
  RANKED_DEFAULT_NTP_MAX_CLIENT_OFFSET_MS,
  RANKED_DEFAULT_SLOW_RESPONSE_WARNING_MS,
  RANKED_DEFAULT_MAX_CONSECUTIVE_SAME_ANSWER,
  RANKED_DEFAULT_SUBMISSION_MAX_PER_WINDOW,
  RANKED_DEFAULT_SUBMISSION_MIN_INTERVAL_MS,
  RANKED_DEFAULT_SUBMISSION_WINDOW_MS,
  RANKED_RESULT_SIGNATURE_VERSION,
} from "../constants";

const MIN_SIGNATURE_SECRET_LENGTH = 32;

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

export interface RankedSubmissionRateLimitConfig {
  minIntervalMs: number;
  windowMs: number;
  maxPerWindow: number;
}

export interface RankedTimingAnomalyConfig {
  minResponseTimeMs: number;
  slowResponseWarningMs: number;
  minAverageAnswerTimeMs: number;
  minAnswerTimeStdDevMs: number;
  maxConsecutiveSameAnswer: number;
}

export interface RankedClockHealthConfig {
  driftWarningMs: number;
  ntpMaxClientOffsetMs: number;
}

export interface RankedResultSigningConfig {
  enabled: boolean;
  version: string;
}

export function getRankedSubmissionRateLimitConfig(): RankedSubmissionRateLimitConfig {
  return {
    minIntervalMs: getPositiveIntegerEnv(
      "RANKED_SUBMISSION_MIN_INTERVAL_MS",
      RANKED_DEFAULT_SUBMISSION_MIN_INTERVAL_MS,
      50
    ),
    windowMs: getPositiveIntegerEnv(
      "RANKED_SUBMISSION_WINDOW_MS",
      RANKED_DEFAULT_SUBMISSION_WINDOW_MS,
      1_000
    ),
    maxPerWindow: getPositiveIntegerEnv(
      "RANKED_SUBMISSION_MAX_PER_WINDOW",
      RANKED_DEFAULT_SUBMISSION_MAX_PER_WINDOW,
      1
    ),
  };
}

export function getRankedTimingAnomalyConfig(): RankedTimingAnomalyConfig {
  return {
    minResponseTimeMs: getPositiveIntegerEnv(
      "RANKED_MIN_RESPONSE_TIME_MS",
      RANKED_DEFAULT_MIN_RESPONSE_TIME_MS,
      1
    ),
    slowResponseWarningMs: getPositiveIntegerEnv(
      "RANKED_SLOW_RESPONSE_WARNING_MS",
      RANKED_DEFAULT_SLOW_RESPONSE_WARNING_MS,
      5_000
    ),
    minAverageAnswerTimeMs: getPositiveIntegerEnv(
      "RANKED_MIN_AVERAGE_ANSWER_TIME_MS",
      RANKED_DEFAULT_MIN_AVERAGE_ANSWER_TIME_MS,
      1
    ),
    minAnswerTimeStdDevMs: getPositiveIntegerEnv(
      "RANKED_MIN_ANSWER_TIME_STD_DEV_MS",
      RANKED_DEFAULT_MIN_ANSWER_TIME_STD_DEV_MS,
      1
    ),
    maxConsecutiveSameAnswer: getPositiveIntegerEnv(
      "RANKED_MAX_CONSECUTIVE_SAME_ANSWER",
      RANKED_DEFAULT_MAX_CONSECUTIVE_SAME_ANSWER,
      2
    ),
  };
}

export function getRankedClockHealthConfig(): RankedClockHealthConfig {
  return {
    driftWarningMs: getPositiveIntegerEnv(
      "RANKED_SERVER_CLOCK_DRIFT_WARNING_MS",
      RANKED_DEFAULT_CLOCK_DRIFT_WARNING_MS,
      1
    ),
    ntpMaxClientOffsetMs: getPositiveIntegerEnv(
      "RANKED_NTP_MAX_CLIENT_OFFSET_MS",
      RANKED_DEFAULT_NTP_MAX_CLIENT_OFFSET_MS,
      1
    ),
  };
}

export function getRankedResultSigningConfig(): RankedResultSigningConfig {
  return {
    enabled: isRankedResultSignatureConfigured(),
    version: RANKED_RESULT_SIGNATURE_VERSION,
  };
}

export function isRankedResultSignatureConfigured(): boolean {
  const secret = process.env.RANKED_RESULT_SIGNATURE_SECRET?.trim();
  return Boolean(secret && secret.length >= MIN_SIGNATURE_SECRET_LENGTH);
}

export function getRankedResultSignatureSecret(): string {
  const secret = process.env.RANKED_RESULT_SIGNATURE_SECRET?.trim();

  if (!secret || secret.length < MIN_SIGNATURE_SECRET_LENGTH) {
    throw new Error(
      "RANKED_RESULT_SIGNATURE_SECRET is missing or too short. Minimum length is 32 characters."
    );
  }

  return secret;
}
