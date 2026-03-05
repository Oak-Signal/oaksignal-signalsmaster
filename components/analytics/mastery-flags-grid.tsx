import Image from "next/image";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { MasteryFlag } from "@/lib/results-types";

interface MasteryFlagsGridProps {
  flags: MasteryFlag[] | null | undefined;
}

export function MasteryFlagsGrid({ flags }: MasteryFlagsGridProps) {
  if (!flags || flags.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Mastered Flags</CardTitle>
          <CardDescription>Flags you consistently answer correctly</CardDescription>
        </CardHeader>
        <CardContent className="h-62.5 flex items-center justify-center text-sm text-muted-foreground">
          Keep practicing to build your mastery set.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mastered Flags</CardTitle>
        <CardDescription>Consistent perfect accuracy (2+ attempts)</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          {flags.map((flag) => (
            <div key={flag.flagId} className="rounded-md border p-2">
              <div className="relative mx-auto mb-2 h-12 w-12 overflow-hidden rounded bg-muted">
                {flag.flagImagePath ? (
                  <Image src={flag.flagImagePath} alt={flag.flagName} fill className="object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-muted-foreground">
                    {flag.flagKey}
                  </div>
                )}
              </div>
              <p className="truncate text-center text-xs font-medium">{flag.flagName}</p>
              <div className="mt-1 flex justify-center">
                <Badge variant="secondary" className="text-[10px]">
                  {flag.attempts} correct
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
