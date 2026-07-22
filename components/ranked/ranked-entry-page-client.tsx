"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Anchor,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Compass,
  Crown,
  Loader2,
  Shield,
  Timer,
  Trophy,
} from "lucide-react";

import { useRankedEntryData } from "@/hooks/use-ranked-entry-data";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const FLEET_RANK_ROWS = [
  { label: "#1", title: "Fleet Master: Signals Master" },
  { label: "#2", title: "Signals Champion" },
  { label: "#3", title: "Signals Guardian" },
  { label: "#4", title: "Signals Centurion" },
  { label: "#5-10", title: "Fleet Specialists" },
  { label: "#11+", title: "Fleet Practitioners" },
] as const;

function formatMs(ms: number | null): string {
  if (!ms || ms <= 0 || ms >= Number.MAX_SAFE_INTEGER) {
    return "N/A";
  }

  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes <= 0) {
    return `${seconds}s`;
  }

  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}

function formatRelativeFuture(timestamp: number | null): string {
  if (!timestamp) {
    return "N/A";
  }

  const deltaMs = timestamp - Date.now();
  if (deltaMs <= 0) {
    return "Available now";
  }

  const totalSeconds = Math.ceil(deltaMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes <= 0) {
    return `${seconds}s`;
  }

  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}

function formatDate(timestamp: number | null): string {
  if (!timestamp) {
    return "N/A";
  }

  return new Date(timestamp).toLocaleString();
}

function badgeIconForRank(badge: string) {
  switch (badge) {
    case "crown_star":
      return Crown;
    case "trophy":
      return Trophy;
    case "shield":
    case "helmet":
      return Shield;
    case "anchor":
      return Anchor;
    default:
      return Compass;
  }
}

function badgeClassForAccent(accent: string): string {
  switch (accent) {
    case "gold":
      return "bg-amber-100 text-amber-800 border-amber-200";
    case "silver":
      return "bg-slate-100 text-slate-700 border-slate-200";
    case "bronze":
      return "bg-orange-100 text-orange-800 border-orange-200";
    case "blue":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "green":
      return "bg-emerald-100 text-emerald-800 border-emerald-200";
    default:
      return "bg-secondary text-secondary-foreground";
  }
}

function isRowCurrentRank(position: number | null, rowLabel: string): boolean {
  if (!position) {
    return rowLabel === "#11+";
  }

  if (position === 1) {
    return rowLabel === "#1";
  }

  if (position === 2) {
    return rowLabel === "#2";
  }

  if (position === 3) {
    return rowLabel === "#3";
  }

  if (position === 4) {
    return rowLabel === "#4";
  }

  if (position >= 5 && position <= 10) {
    return rowLabel === "#5-10";
  }

  return rowLabel === "#11+";
}

function RankedLoadingState() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-4 w-full max-w-2xl" />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {[1, 2, 3].map((index) => (
          <Card key={index}>
            <CardHeader>
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-4 w-48" />
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-8 w-28" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function RankedEntryPageClient() {
  const { context, isLoading, isSignedOut, startRun } = useRankedEntryData();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  const canConfirmStart = (context?.canEnterRankedMode ?? false) && !isStarting;
  const isBlocked = context ? !context.canEnterRankedMode : false;

  const attemptsLabel = useMemo(() => {
    if (!context) {
      return "Attempt policy unavailable";
    }

    const daily =
      context.attemptPolicy.dailyAttemptLimit === null
        ? "Daily: unlimited"
        : `Daily: ${context.attemptPolicy.attemptsToday}/${context.attemptPolicy.dailyAttemptLimit}`;

    const weekly =
      context.attemptPolicy.weeklyAttemptLimit === null
        ? "Weekly: unlimited"
        : `Weekly: ${context.attemptPolicy.attemptsThisWeek}/${context.attemptPolicy.weeklyAttemptLimit}`;

    return `${daily} • ${weekly}`;
  }, [context]);

  const promotionProgress = useMemo(() => {
    if (!context?.rank.leaderboardPosition || !context.nextPromotion.targetPosition) {
      return 0;
    }

    const current = context.rank.leaderboardPosition;
    const target = context.nextPromotion.targetPosition;

    if (current <= target) {
      return 100;
    }

    const ratio = ((current - target) / current) * 100;
    return Math.max(5, Math.min(100, Math.round(ratio)));
  }, [context]);

  const router = useRouter();

  const handleConfirmStart = async () => {
    setIsStarting(true);
    try {
      const result = await startRun();
      setIsModalOpen(false);
      if (result?.runId) {
        router.push(`/dashboard/ranked/run/${result.runId}`);
      }
    } finally {
      setIsStarting(false);
    }
  };

  if (isLoading) {
    return <RankedLoadingState />;
  }

  if (isSignedOut) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Sign In Required</CardTitle>
          <CardDescription>
            You must be signed in to view and enter ranked mode.
          </CardDescription>
        </CardHeader>
        <CardFooter className="gap-2">
          <Button asChild>
            <Link href="/login">Go to Login</Link>
          </Button>
        </CardFooter>
      </Card>
    );
  }

  if (!context) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Ranked Data Unavailable</CardTitle>
          <CardDescription>
            Ranked mode context could not be loaded. Please refresh and try again.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const RankIcon = badgeIconForRank(context.rank.badge);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Ranked Mode</h1>
        <p className="text-muted-foreground max-w-3xl">
          Competitive runs include all flags with server-validated timing and anti-cheat review.
          Review your status and requirements before entering.
        </p>
      </div>

      <Card className={isBlocked ? "border-destructive/40" : "border-emerald-300/40"}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {isBlocked ? (
              <AlertTriangle className="h-5 w-5 text-destructive" />
            ) : (
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            )}
            {isBlocked ? "Ranked Entry Blocked" : "Ready for Ranked Entry"}
          </CardTitle>
          <CardDescription>
            {isBlocked
              ? "Resolve the unmet checks below before starting."
              : "All requirements are met and a ranked run can be started."}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm">
          {isBlocked ? (
            <ul className="list-disc pl-5 space-y-1 text-destructive">
              {[...context.entryRequirements.unmetRequirements, ...context.attemptPolicy.reasons].map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          ) : (
            <p className="text-emerald-700">
              Ranked checks complete. Confirm in the modal to begin your timed run.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RankIcon className="h-5 w-5" />
              Current Fleet Rank
            </CardTitle>
            <CardDescription>
              {context.rank.leaderboardPosition
                ? `#${context.rank.leaderboardPosition} of ${context.rank.leaderboardTotalPlayers} players`
                : "No leaderboard position yet"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Badge className={badgeClassForAccent(context.rank.accent)}>
              {context.rank.currentRankTitle}
            </Badge>
            <p className="text-sm text-muted-foreground">{context.nextPromotion.label}</p>
            <p className="text-sm font-medium">
              {context.nextPromotion.pointsRequired === null
                ? "Points to promotion: N/A"
                : `Points to promotion: ${context.nextPromotion.pointsRequired}`}
            </p>
            <Progress value={promotionProgress} aria-label="Promotion progress" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Personal Best</CardTitle>
            <CardDescription>Best ranked performance this season</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="font-medium">Score: {context.personalBest.score ?? "N/A"}</p>
            <p>Time: {formatMs(context.personalBest.runDurationMs)}</p>
            <p>
              Accuracy: {context.personalBest.accuracyPercent === null ? "N/A" : `${context.personalBest.accuracyPercent}%`}
            </p>
            <p>
              Estimated run duration: {formatMs(context.runOverview.estimatedDurationMs)} for {context.runOverview.flagCount} flags
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Entry Requirements</CardTitle>
            <CardDescription>Eligibility and anti-spam policy checks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>
              Formal exam requirement: {context.entryRequirements.requiresPassedFormalExam ? "Required" : "Not required"}
            </p>
            <p>
              Formal exam status: {context.entryRequirements.hasPassedFormalExam ? "Passed" : "Not passed"}
            </p>
            <p>{attemptsLabel}</p>
            {context.attemptPolicy.nextAllowedAt ? (
              <p>
                Next attempt available: {formatDate(context.attemptPolicy.nextAllowedAt)}
                <span className="ml-2 text-muted-foreground">({formatRelativeFuture(context.attemptPolicy.nextAllowedAt)})</span>
              </p>
            ) : null}
            {context.entryRequirements.unmetRequirements.length > 0 ? (
              <ul className="list-disc pl-5 text-destructive">
                {context.entryRequirements.unmetRequirements.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            ) : (
              <p className="text-emerald-700">All requirements met.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Ranked Rules</CardTitle>
            <CardDescription>Understand these rules before entering</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-muted-foreground list-disc pl-5">
              {context.rules.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Fleet Rank Progression</CardTitle>
            <CardDescription>Promotion tiers by leaderboard position</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {FLEET_RANK_ROWS.map((row) => {
              const isCurrent = isRowCurrentRank(
                context.rank.leaderboardPosition,
                row.label
              );

              return (
                <div
                  key={row.label}
                  className={`flex items-center justify-between rounded-md border px-3 py-2 ${
                    isCurrent ? "border-primary/50 bg-primary/5" : "border-border"
                  }`}
                >
                  <span className="font-medium">{row.label}</span>
                  <span className="text-muted-foreground">{row.title}</span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top 3 Leaderboard</CardTitle>
            <CardDescription>Current leaders for this season</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {context.leaderboardPreview.length === 0 ? (
              <p className="text-sm text-muted-foreground">No ranked submissions yet this season.</p>
            ) : (
              context.leaderboardPreview.map((entry) => (
                <div key={entry.userId} className="rounded-lg border p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">#{entry.position} {entry.name}</p>
                    <Badge className={badgeClassForAccent(entry.rankAccent)}>{entry.rankTitle}</Badge>
                  </div>
                  <p className="text-muted-foreground mt-1">
                    Score {entry.score} • {formatMs(entry.runDurationMs)} • {entry.accuracyPercent}% accuracy
                  </p>
                </div>
              ))
            )}
            <Button asChild variant="outline" size="sm" className="w-full">
              <Link href="/dashboard/ranked/leaderboard">
                View Full Leaderboard
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Ranked Attempts</CardTitle>
            <CardDescription>Your last 5 runs</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {context.recentHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground">No ranked attempts yet.</p>
            ) : (
              context.recentHistory.map((run) => (
                <div key={run.runId} className="rounded-lg border p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">Run {run.runId.slice(0, 8)}</p>
                    <Badge variant="outline">{run.status}</Badge>
                  </div>
                  <p className="text-muted-foreground mt-1">
                    Score {run.score} • {formatMs(run.runDurationMs)} • {run.accuracyPercent}% accuracy
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ready to Compete?</CardTitle>
          <CardDescription>
            {context.season
              ? `${context.season.name} is ${context.season.status}.`
              : "No active season available."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4" />
          <span>
            Season window: {context.season ? `${formatDate(context.season.startsAt)} - ${formatDate(context.season.endsAt)}` : "Unavailable"}
          </span>
          <Timer className="h-4 w-4" />
          <span>
            Estimated duration: {formatMs(context.runOverview.estimatedDurationMs)}
          </span>
        </CardContent>
        <CardFooter className="flex flex-col gap-2 sm:flex-row sm:justify-start">
          <Button
            type="button"
            className="group"
            onClick={() => setIsModalOpen(true)}
            disabled={!context.canEnterRankedMode}
            aria-label="Open ranked run confirmation"
          >
            Enter Ranked Mode
            <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard/practice">Warm-up in Practice</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/dashboard/reference">Review Flags</Link>
          </Button>
        </CardFooter>
      </Card>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Begin ranked run?</DialogTitle>
            <DialogDescription>
              Final checks are enforced server-side. Once submitted, this run is permanent and reviewable.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 text-sm">
            <p className="flex items-center gap-2">
              {context.canEnterRankedMode ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-destructive" />
              )}
              Eligibility: {context.canEnterRankedMode ? "Ready" : "Blocked"}
            </p>
            <p>Estimated duration: {formatMs(context.runOverview.estimatedDurationMs)}</p>
            <p>Flags included: {context.runOverview.flagCount}</p>
            <p>
              Cooldown status: {context.attemptPolicy.isInCooldown ? "Active" : "Clear"}
            </p>
            {context.entryRequirements.unmetRequirements.length > 0 ? (
              <ul className="list-disc pl-5 text-destructive">
                {context.entryRequirements.unmetRequirements.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsModalOpen(false)}
              disabled={isStarting}
              aria-label="Cancel ranked start"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void handleConfirmStart()}
              disabled={!canConfirmStart}
              aria-label="Confirm ranked run start"
            >
              {isStarting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Starting...
                </>
              ) : (
                "Confirm and Start"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
