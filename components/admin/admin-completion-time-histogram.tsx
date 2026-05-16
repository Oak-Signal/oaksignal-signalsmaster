"use client"

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

import type { AdminCompletionHistogramBucket } from "@/lib/admin-analytics-types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface AdminCompletionTimeHistogramProps {
  data: AdminCompletionHistogramBucket[]
}

interface HistogramTooltipPayloadItem {
  payload?: AdminCompletionHistogramBucket
}

interface HistogramTooltipProps {
  active?: boolean
  payload?: HistogramTooltipPayloadItem[]
}

function HistogramTooltip({ active, payload }: HistogramTooltipProps) {
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
      <p className="mt-2 text-muted-foreground">
        Exams: <span className="font-medium text-foreground">{point.count.toLocaleString()}</span>
      </p>
    </div>
  )
}

export function AdminCompletionTimeHistogram({ data }: AdminCompletionTimeHistogramProps) {
  const hasData = data.some((item) => item.count > 0)

  return (
    <Card className="border-border/70">
      <CardHeader>
        <CardTitle>Completion Time Distribution</CardTitle>
        <CardDescription>Histogram of exam completion duration buckets.</CardDescription>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            No completion-time data available for this range.
          </div>
        ) : (
          <div
            className="h-75 w-full min-w-0"
            role="img"
            aria-label="Histogram showing distribution of exam completion times"
          >
            <ResponsiveContainer width="100%" height={300} minWidth={0}>
              <BarChart data={data} margin={{ top: 8, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted-foreground) / 0.2)" />
                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12 }}
                  stroke="hsl(var(--muted-foreground))"
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12 }}
                  stroke="hsl(var(--muted-foreground))"
                  allowDecimals={false}
                />
                <Tooltip cursor={{ fill: "hsl(var(--muted) / 0.45)" }} content={<HistogramTooltip />} />
                <Bar dataKey="count" name="Exam Count" fill="hsl(var(--primary) / 0.75)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
