"use client"

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

import type { AdminTrendPoint } from "@/lib/admin-analytics-types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface AdminPassRateTrendChartProps {
  data: AdminTrendPoint[]
}

interface TrendTooltipPayloadItem {
  payload?: AdminTrendPoint
}

interface TrendTooltipProps {
  active?: boolean
  payload?: TrendTooltipPayloadItem[]
}

function TrendTooltip({ active, payload }: TrendTooltipProps) {
  if (!active || !payload || payload.length === 0) {
    return null
  }

  const point = payload[0]?.payload
  if (!point) {
    return null
  }

  return (
    <div className="rounded-md border bg-background p-3 text-xs shadow-md">
      <p className="font-semibold">{point.label}</p>
      <div className="mt-2 space-y-1 text-muted-foreground">
        <p>
          Attempts: <span className="font-medium text-foreground">{point.attempts.toLocaleString()}</span>
        </p>
        <p>
          Pass Rate: <span className="font-medium text-foreground">{point.passRatePercent.toFixed(2)}%</span>
        </p>
        <p>
          Avg Score: <span className="font-medium text-foreground">{point.averageScorePercent.toFixed(2)}%</span>
        </p>
      </div>
    </div>
  )
}

export function AdminPassRateTrendChart({ data }: AdminPassRateTrendChartProps) {
  const hasData = data.some((item) => item.attempts > 0)

  return (
    <Card className="border-border/70">
      <CardHeader>
        <CardTitle>Pass Rate Trend</CardTitle>
        <CardDescription>Pass rate and average score progression over the selected range.</CardDescription>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            No trend data available for this range.
          </div>
        ) : (
          <div
            className="h-90 w-full min-w-0"
            role="img"
            aria-label="Line chart showing pass rate and average score progression over time"
          >
            <ResponsiveContainer width="100%" height={360} minWidth={0}>
              <LineChart data={data} margin={{ top: 8, right: 10, left: -22, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted-foreground) / 0.2)" />
                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12 }}
                  stroke="hsl(var(--muted-foreground))"
                  minTickGap={16}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12 }}
                  stroke="hsl(var(--muted-foreground))"
                  domain={[0, 100]}
                  tickFormatter={(value) => `${value}%`}
                />
                <Tooltip cursor={{ stroke: "hsl(var(--muted-foreground) / 0.35)", strokeWidth: 1 }} content={<TrendTooltip />} />
                <Legend wrapperStyle={{ fontSize: "12px" }} />
                <Line
                  type="monotone"
                  dataKey="passRatePercent"
                  name="Pass Rate"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 5 }}
                />
                <Line
                  type="monotone"
                  dataKey="averageScorePercent"
                  name="Average Score"
                  stroke="hsl(var(--chart-2, 221 83% 53%))"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
