import { Sparkles } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

/**
 * Shown in the "In Development" tab when nothing is currently in progress, per FR-018. Copy is
 * deliberately reassuring rather than implying the product has stalled.
 */
export function InDevelopmentEmptyState() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
        <Sparkles className="h-8 w-8 text-primary" aria-hidden="true" />
        <p className="text-base font-medium">Nothing actively in progress right now</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Between builds — check the &quot;Latest Updates&quot; and &quot;Roadmap&quot; tabs to see
          what&apos;s shipped and what&apos;s next.
        </p>
      </CardContent>
    </Card>
  );
}
