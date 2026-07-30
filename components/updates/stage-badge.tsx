import { Badge } from "@/components/ui/badge";
import { STAGE_BADGE_COLORS } from "@/lib/content/badge-colors";
import type { Stage } from "@/lib/content/types";
import { cn } from "@/lib/utils";

interface StageBadgeProps {
  stage: Stage;
  className?: string;
}

/** Renders a changelog entry's `stage` with a distinct, consistent color per value (FR-011). */
export function StageBadge({ stage, className }: StageBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn("border-transparent", STAGE_BADGE_COLORS[stage], className)}
    >
      {stage}
    </Badge>
  );
}
