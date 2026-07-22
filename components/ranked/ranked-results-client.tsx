"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import {
  AlertTriangle,
  Award,
  BadgeCheck,
  Calendar,
  CheckCheck,
  CheckCircle2,
  Clock,
  Fingerprint,
  ExternalLink,
  Flame,
  Hash,
  Home,
  Loader2,
  Percent,
  RefreshCw,
  Trophy,
} from "lucide-react";

import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { RankedRankProgressCard } from "@/components/ranked/ranked-rank-progress-card";

interface RankedResultsClientProps {
  runId: string;
}

function formatDuration(ms: number | null): string {
  if (!ms || ms <= 0) return "N/A";
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes <= 0) {
    return `${seconds}s`;
  }
  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}

export function RankedResultsClient({ runId }: RankedResultsClientProps) {
  const run = useQuery(api.ranked.getRankedRunState, {
    runId: runId as Id<"rankedRuns">,
  });

  const entryContext = useQuery(api.ranked.getRankedEntryContext, {});
  const rankChange = useQuery(api.ranked.getRankedRunRankChange, {
    runId: runId as Id<"rankedRuns">,
  });

  if (run === undefined || entryContext === undefined) {
    return (
      <div className="flex flex-col items-center justify-center min-h-125">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground mt-4">Compiling run stats...</p>
      </div>
    );
  }

  if (!run) {
    return (
      <Card className="max-w-md mx-auto mt-12 border-destructive/40 bg-destructive/5 text-center">
        <CardHeader>
          <CardTitle className="text-destructive">Run Not Found</CardTitle>
          <CardDescription>We could not retrieve details for this ranked attempt.</CardDescription>
        </CardHeader>
        <CardFooter className="justify-center">
          <Button asChild variant="outline">
            <Link href="/dashboard/ranked">Return to Ranked Dashboard</Link>
          </Button>
        </CardFooter>
      </Card>
    );
  }

  const isFlagged = run.antiCheatStatus === "flagged";
  const avgResponseTimeMs = run.runDurationMs ? Math.round(run.runDurationMs / run.flagCount) : 0;
  const hasVerification = run.hasSignedResult && run.signatureVersion && run.signatureIssuedAt;
  const normalizedSuspiciousFlags = run.suspiciousFlags ?? [];

  return (
    <div className="space-y-6 max-w-4xl mx-auto py-6">
      {/* Title Header */}
      <div className="flex flex-col items-center text-center gap-2">
        <Award className="h-16 w-16 text-primary" />
        <h1 className="text-3xl font-extrabold tracking-tight">Ranked Run Finalized</h1>
        <p className="text-muted-foreground max-w-lg">
          Your run has been registered and verified by the server. See your performance details below.
        </p>
      </div>

      {/* Main Score & Anti-Cheat validation */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Score Card */}
        <Card className="md:col-span-2 relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 right-0 p-4 opacity-5">
            <Trophy className="h-40 w-40" />
          </div>
          <CardHeader>
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Overall Points</CardTitle>
            <CardDescription className="text-5xl font-black text-foreground tracking-tight mt-2 select-all">
              {run.score.toLocaleString()}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 border-t pt-4 text-sm">
            <div className="flex flex-col gap-0.5">
              <span className="text-muted-foreground font-semibold">Accuracy Base</span>
              <span className="font-bold text-foreground text-lg">
                +{run.pointsFromAccuracy.toLocaleString()}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-muted-foreground font-semibold">Time Penalty</span>
              <span className="font-bold text-foreground text-lg">
                {run.pointsFromTime.toLocaleString()}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Integrity status card */}
        <Card className={`flex flex-col justify-between ${isFlagged ? "border-amber-500/30 bg-amber-500/5" : "border-emerald-600/30 bg-emerald-600/5"}`}>
          <CardHeader>
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Integrity Status</CardTitle>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {hasVerification ? (
                <>
                  <BadgeCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Signed Result {run.signatureVersion}</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <span>Result signature unavailable</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-2 mt-4">
              {isFlagged ? (
                <AlertTriangle className="h-6 w-6 text-amber-500 shrink-0" />
              ) : (
                <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400 shrink-0" />
              )}
              <span className={`font-bold text-lg ${isFlagged ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                {isFlagged ? "Flagged for Review" : "Verified Clear"}
              </span>
            </div>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground pb-4 leading-relaxed">
            {isFlagged ? (
              <div className="space-y-2">
                <p>
                  Server-side integrity analytics flagged this run for review. Leaderboard eligibility may be deferred pending administrator verification.
                </p>
                {normalizedSuspiciousFlags.length > 0 && (
                  <ul className="list-disc pl-4 space-y-1 text-amber-600 dark:text-amber-300">
                    {normalizedSuspiciousFlags.slice(0, 4).map((flag) => (
                      <li key={flag}>{flag}</li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <p>
                Run duration and submission patterns successfully validated by anti-cheat filters. Score posted to the season leaderboard.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="bg-muted/30">
        <CardHeader>
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <CheckCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            Server Verification
          </CardTitle>
          <CardDescription>
            Final score is immutable and generated entirely from server-side timing and answer records.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="rounded border p-3 bg-background/50">
            <p className="text-muted-foreground mb-1">Finalized At</p>
            <p className="font-semibold text-foreground">
              {run.finalizedAt ? new Date(run.finalizedAt).toLocaleString() : "N/A"}
            </p>
          </div>
          <div className="rounded border p-3 bg-background/50">
            <p className="text-muted-foreground mb-1 flex items-center gap-1"><Hash className="h-3 w-3" /> Run Checksum</p>
            <p className="font-mono text-[11px] text-foreground break-all">
              {run.runChecksum ?? "N/A"}
            </p>
          </div>
          <div className="rounded border p-3 bg-background/50">
            <p className="text-muted-foreground mb-1 flex items-center gap-1"><Fingerprint className="h-3 w-3" /> Signature</p>
            <p className="font-semibold text-foreground">
              {hasVerification
                ? `${run.signatureVersion} • ${new Date(run.signatureIssuedAt ?? 0).toLocaleTimeString()}`
                : "Unavailable"}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Primary Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Accuracy */}
        <Card className="shadow-sm">
          <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0">
            <span className="text-xs text-muted-foreground font-semibold">Accuracy</span>
            <Percent className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold">{run.accuracyPercent}%</div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {run.correctCount} / {run.flagCount} flags
            </p>
          </CardContent>
        </Card>

        {/* Total Duration */}
        <Card className="shadow-sm">
          <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0">
            <span className="text-xs text-muted-foreground font-semibold">Duration</span>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold">{formatDuration(run.runDurationMs)}</div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Total elapsed run time
            </p>
          </CardContent>
        </Card>

        {/* Speed Average */}
        <Card className="shadow-sm">
          <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0">
            <span className="text-xs text-muted-foreground font-semibold">Speed Avg</span>
            <Flame className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold">{(avgResponseTimeMs / 1000).toFixed(2)}s</div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Per-question response time
            </p>
          </CardContent>
        </Card>

        {/* Fleet Position Projection */}
        <Card className="shadow-sm">
          <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0">
            <span className="text-xs text-muted-foreground font-semibold">Leaderboard</span>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold">
              {entryContext?.rank.leaderboardPosition
                ? `#${entryContext.rank.leaderboardPosition}`
                : "Unranked"}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              of {entryContext?.rank.leaderboardTotalPlayers ?? 0} active cadets
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Rank progression (US5): fleet rank, position, and this run's rank change */}
      {entryContext ? (
        <RankedRankProgressCard
          rank={entryContext.rank}
          nextPromotion={entryContext.nextPromotion}
          rankChange={rankChange ?? null}
        />
      ) : null}

      {/* Season projection status */}
      <Card className="bg-muted/20">
        <CardHeader>
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Award className="h-4 w-4 text-primary" />
            Current Rank Projection: {entryContext?.rank.currentRankTitle ?? "Unranked"}
          </CardTitle>
          <CardDescription>
            {entryContext?.nextPromotion.label ?? "Submit more scores to climb the leaderboards."}
          </CardDescription>
        </CardHeader>
        {entryContext?.rank.isRanked && (
          <CardContent className="text-xs text-muted-foreground border-t pt-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              <span>Season: {entryContext.season?.name ?? "N/A"}</span>
            </div>
            <span>Personal Best: {entryContext.personalBest.score ?? 0} points</span>
          </CardContent>
        )}
      </Card>

      {/* Button navigation section */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-6">
        <Button asChild size="lg" className="w-full sm:w-auto">
          <Link href="/dashboard/ranked">
            <Home className="mr-2 h-4 w-4" aria-hidden="true" />
            Return to Ranked Mode
          </Link>
        </Button>
        <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
          <Link href="/dashboard/practice">
            <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
            Warm-up in Practice Mode
          </Link>
        </Button>
        <Button asChild variant="ghost" size="lg" className="w-full sm:w-auto">
          <Link href="/dashboard">
            Go to dashboard
            <ExternalLink className="ml-2 h-3 w-3" aria-hidden="true" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
