import { CalendarClock } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

/** Shown in the "Latest Updates" tab when no changelog entries exist yet, per FR-015. */
export function ChangelogEmptyState() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
        <CalendarClock className="h-8 w-8 text-primary" aria-hidden="true" />
        <p className="text-base font-medium">No updates yet</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Check back soon — every update we ship will show up here first.
        </p>
      </CardContent>
    </Card>
  );
}
