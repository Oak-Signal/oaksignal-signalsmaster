export const RANKED_DEFAULT_CONFIG_KEY = "default";
export const RANKED_MIGRATION_V1_CONFIRMATION = "ROLLBACK_RANKED_MODE_V1";
export const RANKED_DEFAULT_COOLDOWN_MINUTES = 5;
export const RANKED_DEFAULT_DAILY_ATTEMPT_LIMIT = 10;
export const RANKED_DEFAULT_WEEKLY_ATTEMPT_LIMIT = 40;

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
