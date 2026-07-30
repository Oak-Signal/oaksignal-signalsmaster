import type { Category, RoadmapStatus, Stage } from "@/lib/content/types";

/**
 * Centralized stage/category/status → Tailwind class lookup for the public Dev/Changelog &
 * Roadmap feature (`/updates`). This is the single seam for badge colors so every place a given
 * value is rendered (changelog timeline, in-development cards, roadmap groups) stays visually
 * consistent, per FR-011/FR-017/FR-020 and research.md §9.
 *
 * All classes follow this repo's existing hand-picked semantic badge convention (see
 * `components/admin/admin-exam-review-client.tsx`, `components/practice/encouragement-message.tsx`):
 * `bg-{color}-100 text-{color}-800 dark:bg-{color}-900/30 dark:text-{color}-300`.
 */

/** Stage badge color, distinct and consistent per value across the page (FR-011). */
export const STAGE_BADGE_COLORS: Record<Stage, string> = {
  "Pre-Alpha":
    "bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-300",
  Alpha: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  "Closed Beta": "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  "Open Beta": "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300",
  "Release Candidate":
    "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300",
  "General Availability":
    "bg-lime-100 text-lime-800 dark:bg-lime-900/30 dark:text-lime-300",
  Production: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
};

/** Category badge color for the known category set (FR-011). */
export const CATEGORY_BADGE_COLORS: Record<Category, string> = {
  feature: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  bugfix: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  improvement: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300",
  security: "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300",
  performance: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
};

/** Fallback color for an unrecognized `category` value, which FR-005 requires to still render. */
export const UNKNOWN_CATEGORY_BADGE_COLOR =
  "bg-slate-100 text-slate-800 dark:bg-slate-800/50 dark:text-slate-300";

/**
 * Resolves the Tailwind class string for a changelog entry's `category`, falling back to
 * `UNKNOWN_CATEGORY_BADGE_COLOR` for values outside the known set (FR-005).
 */
export function getCategoryBadgeColor(category: string): string {
  return category in CATEGORY_BADGE_COLORS
    ? CATEGORY_BADGE_COLORS[category as Category]
    : UNKNOWN_CATEGORY_BADGE_COLOR;
}

/**
 * "In Development" items have a single, fixed "In Progress" indicator — visually distinct from
 * both stage badges and roadmap status badges (FR-017).
 */
export const IN_PROGRESS_BADGE_COLOR =
  "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300";

/** Roadmap status badge color, distinct between "Planned" and "In Consideration" (FR-020). */
export const ROADMAP_STATUS_BADGE_COLORS: Record<RoadmapStatus, string> = {
  Planned: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300",
  "In Consideration":
    "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
};
