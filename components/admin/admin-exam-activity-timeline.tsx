"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export type AdminTimelineRange = "7d" | "30d" | "90d";
export type AdminTimelineView = "daily" | "weekly" | "monthly";

export interface AdminStatsTimelinePoint {
  periodKey: string;
  label: string;
  rangeLabel: string;
  totalExams: number;
  passedExams: number;
  failedExams: number;
  passRatePercent: number;
  isPeak: boolean;
}

export interface AdminStatsTimelineData {
  range: AdminTimelineRange;
  view: AdminTimelineView;
  timeZone: string;
  points: AdminStatsTimelinePoint[];
  peakTotalExams: number;
  generatedAt: number;
}

interface AdminExamActivityTimelineProps {
  data: AdminStatsTimelineData | null;
  isLoading?: boolean;
}

interface TimelineTooltipPayloadItem {
  payload?: AdminStatsTimelinePoint;
}

interface TimelineTooltipProps {
  active?: boolean;
  payload?: TimelineTooltipPayloadItem[];
}

function TimelineTooltip({ active, payload }: TimelineTooltipProps) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const point = payload[0]?.payload;
  if (!point) {
    return null;
  }

  return (
    <div className="rounded-md border bg-background p-3 text-xs shadow-md">
      <p className="font-semibold">{point.rangeLabel}</p>
      <div className="mt-2 space-y-1 text-muted-foreground">
        <p>
          Total Exams: <span className="font-medium text-foreground">{point.totalExams}</span>
        </p>
        <p>
          Passed: <span className="font-medium text-foreground">{point.passedExams}</span>
        </p>
        <p>
          Failed: <span className="font-medium text-foreground">{point.failedExams}</span>
        </p>
        <p>
          Pass Rate: <span className="font-medium text-foreground">{point.passRatePercent.toFixed(2)}%</span>
        </p>
        {point.isPeak ? (
          <p className="font-medium text-primary">Peak testing period</p>
        ) : null}
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <Card className="border-border/70">
      <CardHeader>
        <CardTitle>Exam Activity Timeline</CardTitle>
        <CardDescription>Track official exam volume and outcomes over time.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Skeleton className="h-72 w-full" />
        <div className="grid grid-cols-3 gap-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </CardContent>
    </Card>
  );
}

export function AdminExamActivityTimeline({ data, isLoading = false }: AdminExamActivityTimelineProps) {
  if (isLoading && !data) {
    return <LoadingState />;
  }

  if (!data) {
    return (
      <Card className="border-border/70">
        <CardHeader>
          <CardTitle>Exam Activity Timeline</CardTitle>
          <CardDescription>Track official exam volume and outcomes over time.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Timeline data is currently unavailable.
        </CardContent>
      </Card>
    );
  }

  const hasActivity = data.points.some((point) => point.totalExams > 0);
  const peakPeriods = data.points.filter((point) => point.isPeak && point.totalExams > 0);

  return (
    <Card className="border-border/70">
      <CardHeader>
        <CardTitle>Exam Activity Timeline</CardTitle>
        <CardDescription>
          Official exam activity in the selected period with pass/fail breakdown.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!hasActivity ? (
          <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            No exam activity found for the selected range.
          </div>
        ) : (
          <div className="h-80 w-full min-w-0">
            <ResponsiveContainer width="100%" height={320} minWidth={0}>
              <BarChart data={data.points} margin={{ top: 8, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="hsl(var(--muted-foreground) / 0.2)"
                />
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
                  allowDecimals={false}
                />
                <Tooltip cursor={{ fill: "hsl(var(--muted) / 0.45)" }} content={<TimelineTooltip />} />
                <Legend wrapperStyle={{ fontSize: "12px" }} />
                <Bar dataKey="passedExams" stackId="exams" name="Passed" radius={[4, 4, 0, 0]}>
                  {data.points.map((point) => (
                    <Cell
                      key={`passed-${point.periodKey}`}
                      fill={point.isPeak ? "hsl(var(--primary))" : "hsl(var(--primary) / 0.65)"}
                    />
                  ))}
                </Bar>
                <Bar dataKey="failedExams" stackId="exams" name="Failed" radius={[4, 4, 0, 0]}>
                  {data.points.map((point) => (
                    <Cell
                      key={`failed-${point.periodKey}`}
                      fill={point.isPeak ? "hsl(var(--destructive))" : "hsl(var(--destructive) / 0.6)"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {hasActivity && peakPeriods.length > 0 ? (
          <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            Peak volume: <span className="font-medium text-foreground">{data.peakTotalExams}</span> exam(s) in{" "}
            <span className="font-medium text-foreground">
              {peakPeriods.slice(0, 3).map((point) => point.rangeLabel).join(", ")}
              {peakPeriods.length > 3 ? ` (+${peakPeriods.length - 3} more)` : ""}
            </span>
            .
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
