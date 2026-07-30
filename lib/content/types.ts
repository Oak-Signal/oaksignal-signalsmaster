/**
 * Shared content types for the public Dev/Changelog & Roadmap feature.
 *
 * These types describe the data returned by the `lib/content/*.ts` loaders (added in a later
 * phase) after Markdown frontmatter has been parsed and validated. See
 * `specs/002-public-changelog-roadmap/data-model.md` for the full field-by-field contract.
 */

/** Product maturity at the time of a changelog entry. Fixed set — expanding is out of scope. */
export type Stage = "Pre-Alpha" | "Alpha" | "Closed Beta" | "Open Beta" | "Release Candidate" | "General Availability" | "Production"

/**
 * Known changelog entry categories. The `category` field on `ChangelogEntry` is typed as
 * `string` (not this union) because unrecognized values must be preserved, not dropped (FR-005).
 * `KNOWN_CATEGORIES` is exposed for exhaustive lookup/fallback handling in badge components.
 */
export type Category = "feature" | "bugfix" | "improvement" | "security" | "performance";

export const KNOWN_CATEGORIES: readonly Category[] = [
  "feature",
  "bugfix",
  "improvement",
  "security",
  "performance",
] as const;

/** Roadmap grouping key. */
export type Timeframe = "Short-term" | "Mid-term" | "Long-term";

/** Roadmap item status indicator. */
export type RoadmapStatus = "Planned" | "In Consideration";

/** A single changelog entry, sourced from one file in `content/changelog/*.md`. */
export interface ChangelogEntry {
  /** Derived from the filename (no extension). Used as React key / anchor. */
  slug: string;
  /** Freeform version label (semver or informal). */
  version: string;
  /** ISO `YYYY-MM-DD` date string (kept as a string so it stays serializable across the
   * Server → Client Component boundary; parsed to `Date` only where sorting/formatting happens). */
  date: string;
  title: string;
  /** Defaults to `"Pre-Alpha"` when absent/invalid. */
  stage: Stage;
  /** Defaults to `"improvement"` when absent; unrecognized raw values are preserved as-is. */
  category: string;
  /** Raw Markdown body. May be an empty string (frontmatter-only entries are valid). */
  body: string;
}

/** A single in-progress item, sourced from one file in `content/in-development/*.md`. */
export interface InDevelopmentItem {
  /** Derived from the filename (no extension). */
  slug: string;
  title: string;
  description: string;
  /** Raw Markdown body, optional supplemental detail. Defaults to `""`. */
  body: string;
  /** Controls ascending display order. Defaults to `0`. */
  order: number;
}

/** A single roadmap entry, sourced from the `items` array in `content/roadmap.md`. */
export interface RoadmapItem {
  title: string;
  /** Defaults to `""`. */
  description: string;
  /** Missing/invalid timeframe items are bucketed under `"Uncategorized"` by the loader, not dropped. */
  timeframe: Timeframe | "Uncategorized";
  /** Defaults to `"Planned"`. */
  status: RoadmapStatus;
}

/** Return shape of the roadmap loader. */
export interface RoadmapData {
  /** Keyed by timeframe (including the `"Uncategorized"` fallback); empty groups are omitted. */
  groups: Partial<Record<Timeframe | "Uncategorized", RoadmapItem[]>>;
  /** Optional free-text intro copy above the grouped items. `""` when none. */
  introBody: string;
}
