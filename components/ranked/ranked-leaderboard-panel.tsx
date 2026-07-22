"use client";

/**
 * Ranked Leaderboard Panel
 *
 * Live, season-scoped leaderboard (US4). Reactive via Convex `useQuery` (no polling) — standings
 * reflect a finalized result within ~2s for any viewer with the panel open. Renders fleet rank
 * badges/icons and highlights the caller's own entry so it is identifiable at a glance.
 */

import { motion } from "framer-motion";
import { useQuery } from "convex/react";
import { Anchor, Compass, Crown, Shield, Trophy } from "lucide-react";

import { api } from "@/convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

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

function formatMs(ms: number): string {
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

function LeaderboardLoadingState() {
  return (
    <div className="space-y-3" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((index) => (
        <Skeleton key={index} className="h-16 w-full rounded-lg" />
      ))}
    </div>
  );
}

export function RankedLeaderboardPanel() {
  const view = useQuery(api.ranked.getSeasonLeaderboardView, {});

  const isLoading = view === undefined;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Season Leaderboard</CardTitle>
        <CardDescription>
          {isLoading || !view.season
            ? "Live standings for the active season"
            : `Live standings for ${view.season.name}`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <LeaderboardLoadingState />
        ) : !view.season || view.entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No ranked submissions yet this season. Be the first to set a score.
          </p>
        ) : (
          <ol className="space-y-2" role="list" aria-label="Season leaderboard standings">
            {view.entries.map((entry, index) => {
              const RankIcon = badgeIconForRank(entry.fleetRank.badge);

              return (
                <motion.li
                  key={entry.userId}
                  role="listitem"
                  aria-current={entry.isCurrentUser ? "true" : undefined}
                  aria-label={`Position ${entry.position}: ${entry.name} - ${entry.fleetRank.title}, score ${entry.score}`}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: Math.min(index, 10) * 0.03 }}
                  className={cn(
                    "flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between",
                    entry.isCurrentUser
                      ? "border-primary/60 bg-primary/5 ring-1 ring-primary/30"
                      : "border-border"
                  )}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-secondary-foreground"
                      aria-hidden="true"
                    >
                      #{entry.position}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {entry.name}
                        {entry.isCurrentUser ? (
                          <span className="ml-2 text-xs font-normal text-muted-foreground">(You)</span>
                        ) : null}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {entry.score} pts • {formatMs(entry.runDurationMs)} • {entry.accuracyPercent}% accuracy
                      </p>
                    </div>
                  </div>
                  <Badge
                    className={cn("flex w-fit shrink-0 items-center gap-1", badgeClassForAccent(entry.fleetRank.accent))}
                  >
                    <RankIcon className="h-3.5 w-3.5" aria-hidden="true" />
                    {entry.fleetRank.title}
                  </Badge>
                </motion.li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
