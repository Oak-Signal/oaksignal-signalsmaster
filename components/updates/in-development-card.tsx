import { Hammer } from "lucide-react";

import { MarkdownBody } from "@/components/updates/markdown-body";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { IN_PROGRESS_BADGE_COLOR } from "@/lib/content/badge-colors";
import type { InDevelopmentItem } from "@/lib/content/types";
import { cn } from "@/lib/utils";

interface InDevelopmentCardProps {
  item: InDevelopmentItem;
}

/**
 * Renders a single in-development item: title, short description, and an "In Progress"
 * indicator — deliberately distinct (icon + color) from both the changelog stage badges and the
 * roadmap status badges, per FR-017.
 */
export function InDevelopmentCard({ item }: InDevelopmentCardProps) {
  const hasBody = item.body.trim().length > 0;

  return (
    <Card className="gap-4 transition-shadow hover:shadow-md focus-within:shadow-md">
      <CardHeader className="flex flex-col gap-3">
        <Badge
          variant="outline"
          className={cn("w-fit gap-1.5 border-transparent", IN_PROGRESS_BADGE_COLOR)}
        >
          <Hammer className="h-3.5 w-3.5" aria-hidden="true" />
          In Progress
        </Badge>
        <div className="space-y-1">
          <h3 className="text-lg font-semibold tracking-tight sm:text-xl">{item.title}</h3>
          <p className="text-sm text-muted-foreground">{item.description}</p>
        </div>
      </CardHeader>
      {hasBody && (
        <CardContent>
          <MarkdownBody body={item.body} />
        </CardContent>
      )}
    </Card>
  );
}
