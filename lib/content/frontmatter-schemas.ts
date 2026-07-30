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
