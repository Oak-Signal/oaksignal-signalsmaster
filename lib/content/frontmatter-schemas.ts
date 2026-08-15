import { z } from "zod";

/**
 * `zod` frontmatter schemas for the public Dev/Changelog & Roadmap content sources. Each schema
 * is the single source of truth for a content type's shape; loaders in `lib/content/*.ts` use
 * `safeParse` against these schemas and never throw on malformed content (FR-003, FR-021).
 *
 * See `specs/002-public-changelog-roadmap/contracts/content-frontmatter-schema.md` for the
 * public, content-author-facing contract these schemas implement.
 */

/**
 * `content/changelog/<slug>.md` frontmatter.
 *
 * `version`, `date`, and `title` are required — a file missing any of these (or with an
 * unparseable `date`) fails `safeParse` entirely, so the loader excludes the whole entry
 * (FR-002/FR-003). `stage` and `category` use `.catch(...)` so an absent or malformed value falls
 * back to its documented default without causing the rest of the entry to be excluded (FR-003).
 * `category` is intentionally typed as a plain (non-enum) string so unrecognized values are
 * preserved as-is rather than rejected (FR-005).
 */
export const changelogFrontmatterSchema = z.object({
  version: z.string().trim().min(1),
  date: z
    .string()
    .trim()
    .min(1)
    .refine((value) => !Number.isNaN(Date.parse(value)), {
      message: "date must be a valid, parseable date string",
    }),
  title: z.string().trim().min(1),
  stage: z
    .enum([
      "Pre-Alpha",
      "Alpha",
      "Closed Beta",
      "Open Beta",
      "Release Candidate",
      "General Availability",
      "Production",
    ])
    .catch("Pre-Alpha"),
  category: z.string().trim().min(1).catch("improvement"),
});

export type ChangelogFrontmatter = z.infer<typeof changelogFrontmatterSchema>;

/**
 * `content/in-development/<slug>.md` frontmatter.
 *
 * `title` and `description` are required — a file missing either fails `safeParse` entirely, so
 * the loader excludes the whole item (FR-016/FR-017). `order` uses `.catch(0)` so an absent or
 * malformed value falls back to its documented default without excluding the item.
 */
export const inDevelopmentFrontmatterSchema = z.object({
  title: z.string().trim().min(1),
  description: z.string().trim().min(1),
  order: z.number().catch(0),
});

export type InDevelopmentFrontmatter = z.infer<typeof inDevelopmentFrontmatterSchema>;

/**
 * A single item within `content/roadmap.md`'s frontmatter `items` array.
 *
 * `title` is required — an item missing it fails `safeParse`, so the loader drops that item only,
 * not the whole file (FR-019). `description` and `status` use `.catch(...)` for their documented
 * defaults. `timeframe` is optional with `.catch(undefined)` so a missing/invalid value is
 * retained (bucketed as `"Uncategorized"` by the loader) instead of dropping the item (FR-021
 * edge case).
 */
export const roadmapItemFrontmatterSchema = z.object({
  title: z.string().trim().min(1),
  description: z.string().trim().catch(""),
  timeframe: z.enum(["Short-term", "Mid-term", "Long-term"]).optional().catch(undefined),
  status: z.enum(["Planned", "In Consideration"]).catch("Planned"),
});

export type RoadmapItemFrontmatter = z.infer<typeof roadmapItemFrontmatterSchema>;
