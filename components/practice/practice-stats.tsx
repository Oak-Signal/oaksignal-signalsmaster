"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Trophy, Target, Clock, TrendingUp } from "lucide-react"
import { PracticeStats as PracticeStatsType } from "@/lib/practice-types"
import { formatStats } from "@/lib/practice-utils"

interface PracticeStatsProps {
  stats: PracticeStatsType | null | undefined
  isLoading?: boolean
}

export function PracticeStats({ stats, isLoading }: PracticeStatsProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Your Practice Stats</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-16" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!stats || stats.totalSessions === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Your Practice Stats</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <Trophy className="h-12 w-12 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">
              No completed practice sessions yet. Finish a session to see your stats!
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const formatted = formatStats({
    totalSessions: stats.totalSessions,
    averageScore: stats.averageScore,
    lastPracticed: stats.lastPracticed,
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Your Practice Stats</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Trophy className="h-3.5 w-3.5" />
              <p className="text-xs font-medium">Completed Sessions</p>
            </div>
            <p className="text-2xl font-bold">{stats.totalSessions}</p>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Target className="h-3.5 w-3.5" />
              <p className="text-xs font-medium">Avg. Score</p>
            </div>
            <p className="text-2xl font-bold">
              {stats.completedSessions > 0 ? formatted.averageScoreText : "N/A"}
            </p>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <TrendingUp className="h-3.5 w-3.5" />
              <p className="text-xs font-medium">Unique Flags Practiced</p>
            </div>
            <p className="text-2xl font-bold">{stats.totalFlagsPracticed}</p>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              <p className="text-xs font-medium">Last Practice</p>
            </div>
            <p className="text-sm font-semibold text-muted-foreground">
              {formatted.lastPracticedText}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
