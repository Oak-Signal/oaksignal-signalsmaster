"use client"

import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { PerformanceTrendChart } from "@/components/analytics/performance-trend-chart"

export function DashboardPerformanceTrend() {
  const trend = useQuery(api.analytics.getPerformanceTrend, { dateRange: "30d" })

  return <PerformanceTrendChart data={trend} />
}
