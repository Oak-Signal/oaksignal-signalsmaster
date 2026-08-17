import { FilterX } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

/** Shown in the "Latest Updates" tab when a stage filter matches zero entries, per FR-035. */
export function ChangelogFilteredEmptyState() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
        <FilterX className="h-8 w-8 text-primary" aria-hidden="true" />
        <p className="text-base font-medium">No updates match this filter</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Try selecting a different development stage, or choose &ldquo;All&rdquo; to see every
          update.
        </p>
      </CardContent>
    </Card>
  );
}
