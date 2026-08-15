import { MarkdownBody } from "@/components/updates/markdown-body";
import { RoadmapGroup } from "@/components/updates/roadmap-group";
import type { RoadmapData, Timeframe } from "@/lib/content/types";

/** Fixed display order: chronological timeframes first, with "Uncategorized" as a fallback. */
const TIMEFRAME_ORDER: (Timeframe | "Uncategorized")[] = [
  "Short-term",
  "Mid-term",
  "Long-term",
  "Uncategorized",
];

interface RoadmapSectionProps {
  data: RoadmapData;
}

/**
 * Renders all non-empty roadmap timeframe groups (in `TIMEFRAME_ORDER`) plus any optional intro
 * body — per FR-019/FR-020. Empty groups are simply absent from `data.groups` (FR-021).
 */
export function RoadmapSection({ data }: RoadmapSectionProps) {
  const hasIntro = data.introBody.trim().length > 0;
  const nonEmptyTimeframes = TIMEFRAME_ORDER.filter(
    (timeframe) => (data.groups[timeframe]?.length ?? 0) > 0
  );

  return (
    <div className="space-y-8">
      {hasIntro && <MarkdownBody body={data.introBody} />}
      {nonEmptyTimeframes.map((timeframe) => (
        <RoadmapGroup key={timeframe} timeframe={timeframe} items={data.groups[timeframe]!} />
      ))}
    </div>
  );
}
