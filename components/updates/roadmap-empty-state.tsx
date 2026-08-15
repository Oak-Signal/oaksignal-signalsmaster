import { Map as MapIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

/** Shown in the "Roadmap" tab when `content/roadmap.md` is missing, per FR-021. */
export function RoadmapEmptyState() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
        <MapIcon className="h-8 w-8 text-primary" aria-hidden="true" />
        <p className="text-base font-medium">No roadmap published yet</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Check back soon for a look at what&apos;s planned next.
        </p>
      </CardContent>
    </Card>
  );
}
