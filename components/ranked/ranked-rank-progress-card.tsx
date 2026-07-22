"use client";

/**
 * Ranked Rank Progress Card
 *
 * Presentational card (US5) showing a cadet's current fleet rank, leaderboard position, and
 * progress toward the next promotion tier. When a `rankChange` is supplied (e.g. from the
 * results flow after a finalized run), it also communicates whether the run moved the cadet's
 * standing up, down, held steady, or produced a new leaderboard entry (FR-018).
 */

import { motion } from "framer-motion";
import {
  Anchor,
  ArrowDown,
  ArrowUp,
  Compass,
  Crown,
  Minus,
  Shield,
  Sparkles,
  Trophy,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type {
  RankedCurrentRank,
  RankedNextPromotion,
  RankedRankChange,
} from "@/lib/ranked-types";

interface RankedRankProgressCardProps {
  rank: RankedCurrentRank;
  nextPromotion: RankedNextPromotion;
  /** Rank change caused by a specific finalized run (results flow). Omit for a general standing view. */
  rankChange?: RankedRankChange | null;
}

function renderRankBadgeIcon(badge: string) {
  const iconProps = { className: "h-5 w-5 shrink-0", "aria-hidden": true as const };

  switch (badge) {
    case "crown_star":
      return <Crown {...iconProps} />;
    case "trophy":
      return <Trophy {...iconProps} />;
    case "shield":
    case "helmet":
      return <Shield {...iconProps} />;
    case "anchor":
      return <Anchor {...iconProps} />;
    default:
      return <Compass {...iconProps} />;
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

function getPromotionProgress(rank: RankedCurrentRank, nextPromotion: RankedNextPromotion): number {
  if (!rank.leaderboardPosition || !nextPromotion.targetPosition) {
    return 0;
  }

  const current = rank.leaderboardPosition;
  const target = nextPromotion.targetPosition;

  if (current <= target) {
    return 100;
  }

  const ratio = ((current - target) / current) * 100;
  return Math.max(5, Math.min(100, Math.round(ratio)));
}

function RankChangeBanner({ rankChange }: { rankChange: RankedRankChange }) {
  const { direction, positionDelta, previousRankTitle, currentRankTitle } = rankChange;

  if (direction === "new") {
    return (
      <div
        role="status"
        className="flex items-center gap-2 rounded-md border border-primary/40 bg-primary/5 px-3 py-2 text-sm font-medium text-primary"
      >
        <Sparkles className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>New standing achieved — welcome to the leaderboard!</span>
      </div>
    );
  }

  if (direction === "same") {
    return (
      <div
        role="status"
        className="flex items-center gap-2 rounded-md border border-border bg-secondary/40 px-3 py-2 text-sm text-muted-foreground"
      >
        <Minus className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>Your leaderboard position held steady this run.</span>
      </div>
    );
  }

  const isUp = direction === "up";
  const magnitude = positionDelta !== null ? Math.abs(positionDelta) : null;
  const positionsLabel = magnitude === 1 ? "position" : "positions";
  const titleChanged = previousRankTitle !== null && previousRankTitle !== currentRankTitle;

  return (
    <div
      role="status"
      className={cn(
        "flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium",
        isUp
          ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
          : "border-destructive/40 bg-destructive/10 text-destructive"
      )}
    >
      {isUp ? (
        <ArrowUp className="h-4 w-4 shrink-0" aria-hidden="true" />
      ) : (
        <ArrowDown className="h-4 w-4 shrink-0" aria-hidden="true" />
      )}
      <span>
        {isUp ? "Climbed" : "Dropped"}
        {magnitude !== null ? ` ${magnitude} ${positionsLabel}` : ""}
        {titleChanged ? ` — now ${currentRankTitle}` : ""}
      </span>
    </div>
  );
}

export function RankedRankProgressCard({ rank, nextPromotion, rankChange }: RankedRankProgressCardProps) {
  const progress = getPromotionProgress(rank, nextPromotion);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {renderRankBadgeIcon(rank.badge)}
          Current Fleet Rank
        </CardTitle>
        <CardDescription>
          {rank.leaderboardPosition
            ? `#${rank.leaderboardPosition} of ${rank.leaderboardTotalPlayers} players`
            : "No leaderboard position yet"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {rankChange ? (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
          >
            <RankChangeBanner rankChange={rankChange} />
          </motion.div>
        ) : null}
        <Badge className={cn("w-fit", badgeClassForAccent(rank.accent))}>{rank.currentRankTitle}</Badge>
        <p className="text-sm text-muted-foreground">{nextPromotion.label}</p>
        <p className="text-sm font-medium">
          {nextPromotion.pointsRequired === null
            ? "Points to promotion: N/A"
            : `Points to promotion: ${nextPromotion.pointsRequired}`}
        </p>
        <Progress value={progress} aria-label="Promotion progress" />
      </CardContent>
    </Card>
  );
}
