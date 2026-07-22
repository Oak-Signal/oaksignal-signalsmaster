export const RANKED_DEFAULT_CONFIG_KEY = "default";
export const RANKED_MIGRATION_V1_CONFIRMATION = "ROLLBACK_RANKED_MODE_V1";
export const RANKED_START_CONFIRMATION_TOKEN = "BEGIN_RANKED_RUN";
export const RANKED_DEFAULT_COOLDOWN_MINUTES = 5;
export const RANKED_DEFAULT_DAILY_ATTEMPT_LIMIT = 10;
export const RANKED_DEFAULT_WEEKLY_ATTEMPT_LIMIT = 40;
export const RANKED_ESTIMATED_MS_PER_FLAG = 3500;
export const RANKED_RESULT_SIGNATURE_VERSION = "v1";

export const RANKED_DEFAULT_SUBMISSION_MIN_INTERVAL_MS = 150;
export const RANKED_DEFAULT_SUBMISSION_WINDOW_MS = 60_000;
export const RANKED_DEFAULT_SUBMISSION_MAX_PER_WINDOW = 120;
export const RANKED_DEFAULT_MIN_RESPONSE_TIME_MS = 100;
export const RANKED_DEFAULT_SLOW_RESPONSE_WARNING_MS = 120_000;
export const RANKED_DEFAULT_MIN_AVERAGE_ANSWER_TIME_MS = 350;
export const RANKED_DEFAULT_MIN_ANSWER_TIME_STD_DEV_MS = 250;
export const RANKED_DEFAULT_MAX_CONSECUTIVE_SAME_ANSWER = 8;
export const RANKED_DEFAULT_CLOCK_DRIFT_WARNING_MS = 250;
export const RANKED_DEFAULT_NTP_MAX_CLIENT_OFFSET_MS = 5_000;

// How long a run may sit idle in "started" status (no accepted answer, no completion)
// before it is treated as abandoned/disconnected and auto-voided so the cadet can retry
// (FR-008a). Comfortably above the per-question slow-response warning threshold so a
// single slow question never triggers this.
export const RANKED_STALE_RUN_INACTIVITY_MS = 15 * 60 * 1000;

export const RANKED_RULES = [
  "All signal flags are included in each ranked run.",
  "Speed and accuracy both contribute to your score.",
  "Scoring is based on a combined time and accuracy formula.",
  "Timing is validated server-side to prevent cheating.",
  "Anti-cheat monitoring is active during every run.",
  "Ranked results are permanent and can be reviewed.",
  "Suspicious runs are flagged for manual review.",
] as const;

export const FLEET_RANKS = [
  {
    minPosition: 1,
    maxPosition: 1,
    title: "Fleet Master: Signals Master",
    badge: "crown_star",
    accent: "gold",
  },
  {
    minPosition: 2,
    maxPosition: 2,
    title: "Signals Champion",
    badge: "trophy",
    accent: "silver",
  },
  {
    minPosition: 3,
    maxPosition: 3,
    title: "Signals Guardian",
    badge: "shield",
    accent: "bronze",
  },
  {
    minPosition: 4,
    maxPosition: 4,
    title: "Signals Centurion",
    badge: "helmet",
    accent: "blue",
  },
  {
    minPosition: 5,
    maxPosition: 10,
    title: "Fleet Specialists",
    badge: "anchor",
    accent: "green",
  },
  {
    minPosition: 11,
    maxPosition: Number.MAX_SAFE_INTEGER,
    title: "Fleet Practitioners",
    badge: "compass",
    accent: "standard",
  },
] as const;
