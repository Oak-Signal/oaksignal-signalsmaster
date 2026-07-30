import fs from "node:fs";
import path from "node:path";

import matter from "gray-matter";

import { changelogFrontmatterSchema } from "@/lib/content/frontmatter-schemas";
import type { ChangelogEntry } from "@/lib/content/types";

const CHANGELOG_DIR = path.join(process.cwd(), "content", "changelog");

/**
 * Reads every `*.md` file directly under `content/changelog/`, validates each file's frontmatter
 * against `changelogFrontmatterSchema`, and returns a typed, newest-first sorted list.
 *
 * Never throws for missing/malformed content (FR-003/FR-004): a missing/empty directory resolves
 * to `[]`, and a file with a missing `version`/`date`/`title` or unparseable `date` is excluded
 * (with a `console.warn`) rather than aborting the whole list.
 */
export async function getChangelogEntries(): Promise<ChangelogEntry[]> {
  let filenames: string[];
  try {
    filenames = fs
      .readdirSync(CHANGELOG_DIR)
      .filter((filename) => filename.endsWith(".md"));
  } catch {
    return [];
  }

  const entries: ChangelogEntry[] = [];

  for (const filename of filenames) {
    const slug = filename.slice(0, -".md".length);
    const filePath = path.join(CHANGELOG_DIR, filename);

    let raw: string;
    try {
      raw = fs.readFileSync(filePath, "utf-8");
    } catch (error) {
      console.warn(`[content/changelog] Failed to read "${filename}": ${String(error)}`);
      continue;
    }

    const { data, content } = matter(raw);
    const parsed = changelogFrontmatterSchema.safeParse(data);

    if (!parsed.success) {
      console.warn(
        `[content/changelog] Skipping "${filename}" — invalid frontmatter: ${parsed.error.issues
          .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
          .join("; ")}`
      );
      continue;
    }

    entries.push({
      slug,
      version: parsed.data.version,
      date: parsed.data.date,
      title: parsed.data.title,
      stage: parsed.data.stage,
      category: parsed.data.category,
      body: content.trim(),
    });
  }

  entries.sort((a, b) => {
    const dateDiff = Date.parse(b.date) - Date.parse(a.date);
    return dateDiff !== 0 ? dateDiff : a.slug.localeCompare(b.slug);
  });

  return entries;
}
