import fs from "node:fs";
import path from "node:path";

import matter from "gray-matter";

import { roadmapItemFrontmatterSchema } from "@/lib/content/frontmatter-schemas";
import type { RoadmapData, RoadmapItem, Timeframe } from "@/lib/content/types";

const ROADMAP_FILE = path.join(process.cwd(), "content", "roadmap.md");

/**
 * Reads `content/roadmap.md`, validates each entry in the frontmatter `items` array against
 * `roadmapItemFrontmatterSchema`, and returns the items grouped by `timeframe` plus any Markdown
 * body as `introBody`.
 *
 * Never throws for missing/malformed content (FR-019–FR-021): a missing file resolves to
 * `{ groups: {}, introBody: "" }`, an item missing `title` is dropped (with a `console.warn`),
 * and an item with a missing/invalid `timeframe` is bucketed under `"Uncategorized"` instead of
 * being dropped. Groups with zero items are omitted from the result.
 */
export async function getRoadmapData(): Promise<RoadmapData> {
  let raw: string;
  try {
    raw = fs.readFileSync(ROADMAP_FILE, "utf-8");
  } catch {
    return { groups: {}, introBody: "" };
  }

  const { data, content } = matter(raw);
  const rawItems = Array.isArray(data.items) ? data.items : [];

  const groups: Partial<Record<Timeframe | "Uncategorized", RoadmapItem[]>> = {};

  rawItems.forEach((rawItem, index) => {
    const parsed = roadmapItemFrontmatterSchema.safeParse(rawItem);

    if (!parsed.success) {
      console.warn(
        `[content/roadmap] Skipping item at index ${index} — invalid frontmatter: ${parsed.error.issues
          .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
          .join("; ")}`
      );
      return;
    }

    const timeframe: Timeframe | "Uncategorized" = parsed.data.timeframe ?? "Uncategorized";

    const item: RoadmapItem = {
      title: parsed.data.title,
      description: parsed.data.description,
      timeframe,
      status: parsed.data.status,
    };

    (groups[timeframe] ??= []).push(item);
  });

  return { groups, introBody: content.trim() };
}
