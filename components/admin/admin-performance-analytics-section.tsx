"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

import type {
  AdminAnalyticsCohortGroupBy,
  AdminAnalyticsRange,
  AdminPerformanceAnalyticsPayload,
} from "@/lib/admin-analytics-types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

const ANALYTICS_REFRESH_INTERVAL_MS = 60_000

interface AdminAnalyticsSuccessResponse {
  success: true
  data: AdminPerformanceAnalyticsPayload
}

interface AdminAnalyticsErrorResponse {
  success: false
  error?: {
    message?: string
  }
}

const rangeOptions: Array<{ value: AdminAnalyticsRange; label: string }> = [
  { value: "7d", label: "Last 7 Days" },
  { value: "30d", label: "Last 30 Days" },
  { value: "90d", label: "Last 90 Days" },
]

const cohortOptions: Array<{ value: AdminAnalyticsCohortGroupBy; label: string }> = [
  { value: "role", label: "By Role" },
  { value: "rank", label: "By Rank" },
]

function parseErrorMessage(body: AdminAnalyticsErrorResponse | AdminAnalyticsSuccessResponse): string {
  if (body && "error" in body && body.error?.message) {
    return body.error.message
  }

  return "Unable to load performance analytics."
}

function PerformanceSummaryCards({
  payload,
  isLoading,
}: {
  payload: AdminPerformanceAnalyticsPayload | null
  isLoading: boolean
}) {
  if (isLoading && !payload) {
    return (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
    )
  }

  if (!payload) {
    return null
  }

  const totalAttempts = payload.trend.reduce((sum, point) => sum + point.attempts, 0)
  const totalPassed = Math.round(
    payload.trend.reduce((sum, point) => sum + (point.attempts * point.passRatePercent) / 100, 0)
  )
  const weightedScoreSum = payload.trend.reduce(
    (sum, point) => sum + (point.attempts * point.averageScorePercent),
    0
  )
  const overallPassRate = totalAttempts > 0 ? (totalPassed / totalAttempts) * 100 : 0
  const overallAverageScore = totalAttempts > 0 ? weightedScoreSum / totalAttempts : 0

  const cards = [
    {
      title: "Attempts In Range",
      value: totalAttempts.toLocaleString(),
      description: `For ${payload.range} window`,
    },
    {
      title: "Estimated Pass Rate",
      value: `${overallPassRate.toFixed(2)}%`,
      description: "Weighted across trend points",
    },
    {
      title: "Estimated Average Score",
      value: `${overallAverageScore.toFixed(2)}%`,
      description: "Weighted across trend points",
    },
    {
      title: "Retake Pass Rate",
      value: `${payload.retakeComparison.retakes.passRatePercent.toFixed(2)}%`,
      description: `${payload.retakeComparison.retakes.attempts.toLocaleString()} retake attempts`,
    },
  ]

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.title} className="border-border/70">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight">{card.value}</div>
            <p className="mt-1 text-xs text-muted-foreground">{card.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function BottomFlagsPreview({ payload }: { payload: AdminPerformanceAnalyticsPayload | null }) {
  return (
    <Card className="border-border/70">
      <CardHeader>
        <CardTitle>Most Challenging Flags</CardTitle>
        <CardDescription>Bottom performers by success rate (top 5 preview)</CardDescription>
      </CardHeader>
      <CardContent>
        {!payload || payload.bottomFlags.length === 0 ? (
          <p className="text-sm text-muted-foreground">No flag performance data in the selected range.</p>
        ) : (
          <ul className="space-y-2">
            {payload.bottomFlags.slice(0, 5).map((flag) => (
              <li key={flag.flagKey} className="flex items-center justify-between text-sm">
                <span className="font-medium">{flag.flagName}</span>
                <span className="text-muted-foreground">
                  {flag.passRatePercent.toFixed(2)}% ({flag.correct}/{flag.attempts})
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

function CohortPreview({ payload }: { payload: AdminPerformanceAnalyticsPayload | null }) {
  return (
    <Card className="border-border/70">
      <CardHeader>
        <CardTitle>Cohort Comparison</CardTitle>
        <CardDescription>Current window cohort breakdown</CardDescription>
      </CardHeader>
      <CardContent>
        {!payload || payload.cohortComparison.current.rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No cohort data available for this range.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-125 text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Group</th>
                  <th className="py-2 pr-3 font-medium">Attempts</th>
                  <th className="py-2 pr-3 font-medium">Pass Rate</th>
                  <th className="py-2 pr-3 font-medium">Avg Score</th>
                </tr>
              </thead>
              <tbody>
                {payload.cohortComparison.current.rows.slice(0, 8).map((row) => (
                  <tr key={row.group} className="border-b border-border/50">
                    <td className="py-2 pr-3 font-medium">{row.group}</td>
                    <td className="py-2 pr-3">{row.attempts.toLocaleString()}</td>
                    <td className="py-2 pr-3">{row.passRatePercent.toFixed(2)}%</td>
                    <td className="py-2 pr-3">{row.averageScorePercent.toFixed(2)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function AdminPerformanceAnalyticsSection() {
  const [range, setRange] = useState<AdminAnalyticsRange>("30d")
  const [compareRange, setCompareRange] = useState<AdminAnalyticsRange>("90d")
  const [groupBy, setGroupBy] = useState<AdminAnalyticsCohortGroupBy>("role")
  const [payload, setPayload] = useState<AdminPerformanceAnalyticsPayload | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const timeZone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    []
  )

  const fetchAnalytics = useCallback(
    async (isBackgroundRefresh: boolean) => {
      if (!isBackgroundRefresh) {
        setIsLoading(true)
      }

      try {
        const params = new URLSearchParams({
          range,
          compareRange,
          groupBy,
          timeZone,
        })

        const response = await fetch(`/api/admin/analytics?${params.toString()}`, {
          method: "GET",
          cache: "no-store",
          credentials: "same-origin",
          headers: {
            Accept: "application/json",
          },
        })

        const body = (await response.json()) as
          | AdminAnalyticsSuccessResponse
          | AdminAnalyticsErrorResponse

        if (!response.ok) {
          throw new Error(parseErrorMessage(body))
        }

        if (!body || !("success" in body) || !body.success || !("data" in body)) {
          throw new Error("Unexpected admin analytics response.")
        }

        setPayload(body.data)
        setErrorMessage(null)
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to load performance analytics."
        setErrorMessage(message)
      } finally {
        if (!isBackgroundRefresh) {
          setIsLoading(false)
        }
      }
    },
    [compareRange, groupBy, range, timeZone]
  )

  useEffect(() => {
    void fetchAnalytics(false)
  }, [fetchAnalytics])

  useEffect(() => {
    const intervalId = setInterval(() => {
      void fetchAnalytics(true)
    }, ANALYTICS_REFRESH_INTERVAL_MS)

    return () => {
      clearInterval(intervalId)
    }
  }, [fetchAnalytics])

  const hasData = Boolean(payload && payload.trend.some((point) => point.attempts > 0))

  return (
    <div className="space-y-4">
      <div className="grid gap-3 lg:grid-cols-3">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Primary Range</p>
          <Tabs
            value={range}
            onValueChange={(nextValue) => setRange(nextValue as AdminAnalyticsRange)}
            aria-label="Primary analytics date range"
          >
            <TabsList className="grid w-full grid-cols-3">
              {rangeOptions.map((option) => (
                <TabsTrigger key={option.value} value={option.value} aria-label={option.label}>
                  {option.value}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Comparison Range</p>
          <Tabs
            value={compareRange}
            onValueChange={(nextValue) => setCompareRange(nextValue as AdminAnalyticsRange)}
            aria-label="Comparison date range"
          >
            <TabsList className="grid w-full grid-cols-3">
              {rangeOptions.map((option) => (
                <TabsTrigger key={option.value} value={option.value} aria-label={option.label}>
                  {option.value}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cohort Grouping</p>
          <Tabs
            value={groupBy}
            onValueChange={(nextValue) => setGroupBy(nextValue as AdminAnalyticsCohortGroupBy)}
            aria-label="Cohort grouping"
          >
            <TabsList className="grid w-full grid-cols-2">
              {cohortOptions.map((option) => (
                <TabsTrigger key={option.value} value={option.value} aria-label={option.label}>
                  {option.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      </div>

      {errorMessage ? (
        <p className="text-sm text-destructive" role="status" aria-live="polite">
          {errorMessage}
        </p>
      ) : null}

      <PerformanceSummaryCards payload={payload} isLoading={isLoading} />

      {!isLoading && !errorMessage && !hasData ? (
        <Card className="border-border/70">
          <CardHeader>
            <CardTitle>No Analytics Data Yet</CardTitle>
            <CardDescription>
              There are no completed exam attempts in the selected range.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <BottomFlagsPreview payload={payload} />
          <CohortPreview payload={payload} />
        </div>
      )}
    </div>
  )
}
