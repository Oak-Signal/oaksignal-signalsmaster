import { RoadmapItemCard } from "@/components/updates/roadmap-item-card";
import type { RoadmapItem, Timeframe } from "@/lib/content/types";

interface RoadmapGroupProps {
  timeframe: Timeframe | "Uncategorized";
  items: RoadmapItem[];
}

/** Renders one roadmap timeframe group's heading and items — per FR-019/FR-020. */
export function RoadmapGroup({ timeframe, items }: RoadmapGroupProps) {
  return (
    <section aria-labelledby={`roadmap-group-${timeframe}`} className="space-y-3">
      <h3 id={`roadmap-group-${timeframe}`} className="text-lg font-semibold tracking-tight">
        {timeframe}
      </h3>
      <div className="grid gap-4 sm:grid-cols-2">
        {items.map((item, index) => (
          <RoadmapItemCard key={`${item.title}-${index}`} item={item} />
        ))}
      </div>
    </section>
  );
}
