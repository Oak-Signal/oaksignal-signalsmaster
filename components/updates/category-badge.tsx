import { Bug, Sparkles, Tag, Wrench, ShieldCheck, Zap, type LucideIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { getCategoryBadgeColor } from "@/lib/content/badge-colors";
import { cn } from "@/lib/utils";

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  feature: Sparkles,
  bugfix: Bug,
  improvement: Wrench,
  security: ShieldCheck,
  performance: Zap,
};

interface CategoryBadgeProps {
  category: string;
  className?: string;
}

/**
 * Renders a changelog entry's `category` as an icon + label badge, colored via
 * `getCategoryBadgeColor` (which falls back gracefully for unrecognized values, per FR-005) and
 * visually distinct from `StageBadge` via its icon (FR-011).
 */
export function CategoryBadge({ category, className }: CategoryBadgeProps) {
  const Icon = CATEGORY_ICONS[category] ?? Tag;

  return (
    <Badge
      variant="outline"
      className={cn("border-transparent capitalize", getCategoryBadgeColor(category), className)}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {category}
    </Badge>
  );
}
