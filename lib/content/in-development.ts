import fs from "node:fs";
import path from "node:path";

import matter from "gray-matter";

import { inDevelopmentFrontmatterSchema } from "@/lib/content/frontmatter-schemas";
import type { InDevelopmentItem } from "@/lib/content/types";

const IN_DEVELOPMENT_DIR = path.join(process.cwd(), "content", "in-development");

/**
 * Reads every `*.md` file directly under `content/in-development/`, validates each file's
 * frontmatter against `inDevelopmentFrontmatterSchema`, and returns a typed list sorted ascending
 * by `order`.
 *
 * Never throws for missing/malformed content (FR-016): a missing/empty directory resolves to
 * `[]`, and a file with a missing `title`/`description` is excluded (with a `console.warn`)
 * rather than aborting the whole list.
 */
export async function getInDevelopmentItems(): Promise<InDevelopmentItem[]> {
  let filenames: string[];
  try {
    filenames = fs
      .readdirSync(IN_DEVELOPMENT_DIR)
      .filter((filename) => filename.endsWith(".md"));
  } catch {
    return [];
  }

  const items: InDevelopmentItem[] = [];

  for (const filename of filenames) {
    const slug = filename.slice(0, -".md".length);
    const filePath = path.join(IN_DEVELOPMENT_DIR, filename);

    let raw: string;
    try {
      raw = fs.readFileSync(filePath, "utf-8");
    } catch (error) {
      console.warn(`[content/in-development] Failed to read "${filename}": ${String(error)}`);
      continue;
    }

    const { data, content } = matter(raw);
    const parsed = inDevelopmentFrontmatterSchema.safeParse(data);

    if (!parsed.success) {
      console.warn(
        `[content/in-development] Skipping "${filename}" — invalid frontmatter: ${parsed.error.issues
          .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
          .join("; ")}`
      );
      continue;
    }

    items.push({
      slug,
      title: parsed.data.title,
      description: parsed.data.description,
      order: parsed.data.order,
      body: content.trim(),
    });
  }

  items.sort((a, b) => {
    const orderDiff = a.order - b.order;
    return orderDiff !== 0 ? orderDiff : a.slug.localeCompare(b.slug);
  });

  return items;
}
