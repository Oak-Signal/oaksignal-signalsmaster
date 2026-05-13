"use client"

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

import type { AdminBottomFlagRow } from "@/lib/admin-analytics-types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface AdminBottomFlagsChartProps {
  data: AdminBottomFlagRow[]
}

interface BottomFlagTooltipPayloadItem {
  payload?: AdminBottomFlagRow
}

interface BottomFlagTooltipProps {
  active?: boolean
  payload?: BottomFlagTooltipPayloadItem[]
}

function BottomFlagTooltip({ active, payload }: BottomFlagTooltipProps) {
  if (!active || !payload || payload.length === 0) {
    return null
  }

  const point = payload[0]?.payload
  if (!point) {
    return null
  }

  return (
    <div className="rounded-md border bg-background p-3 text-xs shadow-md">
      <p className="font-semibold">{point.flagName}</p>
      <p className="mt-2 text-muted-foreground">
        Pass Rate: <span className="font-medium text-foreground">{point.passRatePercent.toFixed(2)}%</span>
      </p>
      <p className="text-muted-foreground">
        Correct: <span className="font-medium text-foreground">{point.correct.toLocaleString()}</span>
      </p>
      <p className="text-muted-foreground">
        Attempts: <span className="font-medium text-foreground">{point.attempts.toLocaleString()}</span>
      </p>
    </div>
  )
}

export function AdminBottomFlagsChart({ data }: AdminBottomFlagsChartProps) {
  const hasData = data.length > 0

  return (
    <Card className="border-border/70">
      <CardHeader>
        <CardTitle>Bottom 10 Flags By Success Rate</CardTitle>
        <CardDescription>Most challenging flags based on lowest pass rates.</CardDescription>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            No flag data available for this range.
          </div>
        ) : (
          <div
            className="h-100 w-full min-w-0"
            role="img"
            aria-label="Horizontal bar chart showing bottom ten flags by pass rate"
          >
            <ResponsiveContainer width="100%" height={400} minWidth={0}>
              <BarChart
                data={[...data].reverse()}
                margin={{ top: 8, right: 18, left: 30, bottom: 0 }}
                layout="vertical"
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="hsl(var(--muted-foreground) / 0.2)" />
                <XAxis
                  type="number"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12 }}
                  stroke="hsl(var(--muted-foreground))"
                  domain={[0, 100]}
                  tickFormatter={(value) => `${value}%`}
                />
                <YAxis
                  type="category"
                  dataKey="flagName"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12 }}
                  stroke="hsl(var(--muted-foreground))"
                  width={120}
                />
                <Tooltip cursor={{ fill: "hsl(var(--muted) / 0.45)" }} content={<BottomFlagTooltip />} />
                <Bar dataKey="passRatePercent" name="Pass Rate" fill="hsl(var(--destructive) / 0.8)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
