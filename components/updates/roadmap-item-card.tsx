import { CircleCheck, CircleDashed } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ROADMAP_STATUS_BADGE_COLORS } from "@/lib/content/badge-colors";
import type { RoadmapItem } from "@/lib/content/types";
import { cn } from "@/lib/utils";

interface RoadmapItemCardProps {
  item: RoadmapItem;
}

/**
 * Renders a single roadmap item: title, description, and a status indicator visually distinct
 * between "Planned" and "In Consideration" — per FR-020.
 */
export function RoadmapItemCard({ item }: RoadmapItemCardProps) {
  const StatusIcon = item.status === "Planned" ? CircleCheck : CircleDashed;

  return (
    <Card className="gap-3 transition-shadow hover:shadow-md focus-within:shadow-md">
      <CardHeader className="flex flex-col gap-2">
        <Badge
          variant="outline"
          className={cn("w-fit gap-1.5 border-transparent", ROADMAP_STATUS_BADGE_COLORS[item.status])}
        >
          <StatusIcon className="h-3.5 w-3.5" aria-hidden="true" />
          {item.status}
        </Badge>
        <h4 className="text-base font-semibold tracking-tight">{item.title}</h4>
      </CardHeader>
      {item.description && (
        <CardContent>
          <p className="text-sm text-muted-foreground">{item.description}</p>
        </CardContent>
      )}
    </Card>
  );
}
