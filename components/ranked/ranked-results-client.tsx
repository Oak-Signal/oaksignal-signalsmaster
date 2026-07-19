"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import {
  AlertTriangle,
  Award,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  Flame,
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
import { Badge } from "@/components/ui/badge";

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

  if (run === undefined || entryContext === undefined) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px]">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
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

  return (
    <div className="space-y-6 max-w-4xl mx-auto py-6">
      {/* Title Header */}
      <div className="flex flex-col items-center text-center gap-2">
        <Award className="h-16 w-16 text-emerald-500 animate-pulse drop-shadow-[0_0_15px_rgba(16,185,129,0.3)]" />
        <h1 className="text-3xl font-extrabold tracking-tight">Ranked Run Finalized</h1>
        <p className="text-muted-foreground max-w-lg">
          Your run has been registered and verified by the server. See your performance details below.
        </p>
      </div>

      {/* Main Score & Anti-Cheat validation */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Score Card */}
        <Card className="md:col-span-2 bg-slate-950 border-slate-800 shadow-[0_4px_30px_rgba(0,0,0,0.3)] relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 right-0 p-4 opacity-5">
            <Trophy className="h-40 w-40" />
          </div>
          <CardHeader>
            <CardTitle className="text-xs uppercase tracking-wider text-slate-500">Overall Points</CardTitle>
            <CardDescription className="text-5xl font-black text-slate-100 tracking-tight mt-2 select-all">
              {run.score.toLocaleString()}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 border-t border-slate-900 pt-4 text-sm">
            <div className="flex flex-col gap-0.5">
              <span className="text-slate-500 font-semibold">Accuracy Base</span>
              <span className="font-bold text-slate-200 text-lg">
                +{run.pointsFromAccuracy.toLocaleString()}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-slate-500 font-semibold">Time Speed Bonus</span>
              <span className="font-bold text-amber-500 text-lg">
                +{run.pointsFromTime.toLocaleString()}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Integrity status card */}
        <Card className={`border-slate-800 flex flex-col justify-between ${isFlagged ? "bg-amber-500/5 border-amber-500/20" : "bg-emerald-500/5 border-emerald-500/20"}`}>
          <CardHeader>
            <CardTitle className="text-xs uppercase tracking-wider text-slate-500">Integrity Status</CardTitle>
            <div className="flex items-center gap-2 mt-4">
              {isFlagged ? (
                <AlertTriangle className="h-6 w-6 text-amber-500 flex-shrink-0" />
              ) : (
                <CheckCircle2 className="h-6 w-6 text-emerald-500 flex-shrink-0" />
              )}
              <span className={`font-bold text-lg ${isFlagged ? "text-amber-500" : "text-emerald-500"}`}>
                {isFlagged ? "Flagged for Review" : "Verified Clear"}
              </span>
            </div>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground pb-4 leading-relaxed">
            {isFlagged ? (
              <p>
                Your answer speeds exceeded standard human thresholds. This attempt is temporarily excluded from leaderboards pending administrator review.
              </p>
            ) : (
              <p>
                Run duration and submission patterns successfully validated by anti-cheat filters. Score posted to the season leaderboard.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Primary Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Accuracy */}
        <Card className="border-slate-800 bg-slate-900/20 shadow-sm">
          <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0">
            <span className="text-xs text-muted-foreground font-semibold">Accuracy</span>
            <Percent className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold">{run.accuracyPercent}%</div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {run.correctCount} / {run.flagCount} flags
            </p>
          </CardContent>
        </Card>

        {/* Total Duration */}
        <Card className="border-slate-800 bg-slate-900/20 shadow-sm">
          <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0">
            <span className="text-xs text-muted-foreground font-semibold">Duration</span>
            <Clock className="h-4 w-4 text-sky-500" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold">{formatDuration(run.runDurationMs)}</div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Total elapsed run time
            </p>
          </CardContent>
        </Card>

        {/* Speed Average */}
        <Card className="border-slate-800 bg-slate-900/20 shadow-sm">
          <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0">
            <span className="text-xs text-muted-foreground font-semibold">Speed Avg</span>
            <Flame className="h-4 w-4 text-amber-500 animate-pulse" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold">{(avgResponseTimeMs / 1000).toFixed(2)}s</div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Per-question response time
            </p>
          </CardContent>
        </Card>

        {/* Fleet Position Projection */}
        <Card className="border-slate-800 bg-slate-900/20 shadow-sm">
          <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0">
            <span className="text-xs text-muted-foreground font-semibold">Leaderboard</span>
            <Trophy className="h-4 w-4 text-amber-500" />
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

      {/* Season projection status */}
      <Card className="border-slate-800 bg-slate-900/10">
        <CardHeader>
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Award className="h-4 w-4 text-amber-500" />
            Current Rank Projection: {entryContext?.rank.currentRankTitle ?? "Unranked"}
          </CardTitle>
          <CardDescription>
            {entryContext?.nextPromotion.label ?? "Submit more scores to climb the leaderboards."}
          </CardDescription>
        </CardHeader>
        {entryContext?.rank.isRanked && (
          <CardContent className="text-xs text-muted-foreground border-t border-slate-900 pt-4 flex items-center justify-between gap-4">
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
        <Button asChild className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-500 text-slate-100 gap-1.5 shadow-sm">
          <Link href="/dashboard/ranked">
            <Home className="h-4 w-4" />
            Return to Ranked Mode
          </Link>
        </Button>
        <Button asChild variant="outline" className="w-full sm:w-auto gap-1.5 border-slate-800 hover:bg-slate-900 text-slate-300">
          <Link href="/dashboard/practice">
            <RefreshCw className="h-4 w-4" />
            Warm-up in Practice Mode
          </Link>
        </Button>
        <Button asChild variant="ghost" className="w-full sm:w-auto gap-1.5 text-slate-400 hover:text-slate-200">
          <Link href="/dashboard" className="flex items-center gap-1">
            Go to dashboard
            <ExternalLink className="h-3 w-3" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
