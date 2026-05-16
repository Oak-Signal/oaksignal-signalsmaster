"use client"

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

import type { AdminFlagCategoryPerformanceRow } from "@/lib/admin-analytics-types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface AdminFlagCategoryPerformanceChartProps {
  data: AdminFlagCategoryPerformanceRow[]
}

interface CategoryTooltipPayloadItem {
  payload?: AdminFlagCategoryPerformanceRow
}

interface CategoryTooltipProps {
  active?: boolean
  payload?: CategoryTooltipPayloadItem[]
}

function CategoryTooltip({ active, payload }: CategoryTooltipProps) {
  if (!active || !payload || payload.length === 0) {
    return null
  }

  const point = payload[0]?.payload
  if (!point) {
    return null
  }

  return (
    <div className="rounded-md border bg-background p-3 text-xs shadow-md">
      <p className="font-semibold capitalize">{point.category}</p>
      <div className="mt-2 space-y-1 text-muted-foreground">
        <p>
          Pass Rate: <span className="font-medium text-foreground">{point.passRatePercent.toFixed(2)}%</span>
        </p>
        <p>
          Correct: <span className="font-medium text-foreground">{point.correct}</span>
        </p>
        <p>
          Attempts: <span className="font-medium text-foreground">{point.attempts}</span>
        </p>
      </div>
    </div>
  )
}

export function AdminFlagCategoryPerformanceChart({ data }: AdminFlagCategoryPerformanceChartProps) {
  const hasData = data.some((item) => item.attempts > 0)

  return (
    <Card className="border-border/70">
      <CardHeader>
        <CardTitle>Flag Category Performance</CardTitle>
        <CardDescription>Pass rate by letters, numbers, and special signals.</CardDescription>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            No category performance data available for this range.
          </div>
        ) : (
          <div
            className="h-80 w-full min-w-0"
            role="img"
            aria-label="Bar chart showing pass rate by flag category"
          >
            <ResponsiveContainer width="100%" height={320} minWidth={0}>
              <BarChart data={data} margin={{ top: 8, right: 10, left: -24, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted-foreground) / 0.2)" />
                <XAxis
                  dataKey="category"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12 }}
                  stroke="hsl(var(--muted-foreground))"
                  tickFormatter={(value: string) => value.toUpperCase()}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12 }}
                  stroke="hsl(var(--muted-foreground))"
                  domain={[0, 100]}
                  tickFormatter={(value) => `${value}%`}
                />
                <Tooltip cursor={{ fill: "hsl(var(--muted) / 0.45)" }} content={<CategoryTooltip />} />
                <Bar dataKey="passRatePercent" name="Pass Rate" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
