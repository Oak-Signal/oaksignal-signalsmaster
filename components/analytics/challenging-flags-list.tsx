import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MostMissedFlag } from "@/lib/results-types";
import Image from "next/image";

interface ChallengingFlagsListProps {
  flags: MostMissedFlag[] | undefined | null;
}

export function ChallengingFlagsList({ flags }: ChallengingFlagsListProps) {
  if (!flags || flags.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Challenging Flags</CardTitle>
          <CardDescription>Flags you might need to review</CardDescription>
        </CardHeader>
        <CardContent className="h-62.5 flex items-center justify-center text-sm text-muted-foreground">
          You don&apos;t have any missed flags to review yet. Great job!
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Challenging Flags</CardTitle>
        <CardDescription>Flags with the highest miss rates</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {flags.map((flag) => (
            <div key={flag.flagId} className="flex items-center gap-4">
              <div className="relative w-12 h-12 shrink-0 bg-muted rounded overflow-hidden">
                {flag.flagImagePath ? (
                  <Image 
                    src={flag.flagImagePath} 
                    alt={flag.flagName}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs font-bold text-muted-foreground">
                    {flag.flagKey}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium leading-none truncate">
                  {flag.flagName} {flag.flagCategory ? `(${flag.flagCategory})` : ""}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-destructive" 
                      style={{ width: `${flag.missRate}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {flag.missRate}% miss
                  </span>
                </div>
              </div>
              <div className="text-xs text-muted-foreground text-right shrink-0">
                {flag.misses} / {flag.attempts} <br />
                missed
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
