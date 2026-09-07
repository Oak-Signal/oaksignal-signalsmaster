"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PerformanceTrendPoint } from "@/lib/results-types";
import { format } from "date-fns";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface PerformanceTrendChartProps {
  data: PerformanceTrendPoint[] | null | undefined;
}

type ChartDatum = PerformanceTrendPoint & {
  displayDate: string;
  learnScore: number | null;
  matchScore: number | null;
};

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(100, Math.max(0, Math.round(value)));
}

function resolveDateFormat(width: number): string {
  if (width < 500) {
    return "MMM d";
  }

  if (width < 900) {
    return "MMM d, HH:mm";
  }

  return "MMM d, h:mm a";
}

function resolveAxisBounds(values: number[]): [number, number] {
  if (values.length === 0) {
    return [0, 100];
  }

  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const range = maxValue - minValue;
  const minVisualSpan = 12;

  // Add enough breathing room for narrow score bands while keeping percentages meaningful.
  const padding = Math.max(3, Math.round(range * 0.2));
  let lower = Math.max(0, Math.floor(minValue - padding));
  let upper = Math.min(100, Math.ceil(maxValue + padding));

  if (upper - lower < minVisualSpan) {
    const midpoint = (upper + lower) / 2;
    lower = Math.max(0, Math.floor(midpoint - minVisualSpan / 2));
    upper = Math.min(100, Math.ceil(midpoint + minVisualSpan / 2));
  }

  if (upper <= lower) {
    upper = Math.min(100, lower + minVisualSpan);
  }

  return [lower, upper];
}

export function PerformanceTrendChart({ data }: PerformanceTrendChartProps) {
  const [chartWidth, setChartWidth] = useState(900);
  const dateFormat = resolveDateFormat(chartWidth);

  const chartData = useMemo<ChartDatum[]>(() => {
    const normalizedData = data ?? [];

    return normalizedData.map((point) => {
      const score = clampPercent(point.score);

      return {
        ...point,
        score,
        displayDate: format(new Date(point.date), dateFormat),
        learnScore: point.mode === "learn" ? score : null,
        matchScore: point.mode === "match" ? score : null,
      };
    });
  }, [data, dateFormat]);

  if (!data || data.length === 0) {
    return (
      <Card className="col-span-full">
        <CardHeader>
          <CardTitle>Performance Trend</CardTitle>
          <CardDescription>Your score history over time</CardDescription>
        </CardHeader>
        <CardContent className="h-75 flex items-center justify-center text-muted-foreground">
          Not enough data yet. Complete some practice sessions to see your trend!
        </CardContent>
      </Card>
    );
  }

  if (chartData.length < 2) {
    const onlyPoint = chartData[0];

    return (
      <Card className="col-span-full">
        <CardHeader>
          <CardTitle>Performance Trend</CardTitle>
          <CardDescription>Score percentage across your recent sessions</CardDescription>
        </CardHeader>
        <CardContent className="h-75 flex flex-col items-center justify-center gap-2 text-center text-muted-foreground">
          <p className="font-medium text-foreground">More sessions needed to show a trend</p>
          <p className="text-sm">Complete at least one more session to generate a meaningful line chart.</p>
          <p className="text-xs">Latest score: {onlyPoint.score}% ({onlyPoint.mode === "learn" ? "Learn" : "Match"})</p>
        </CardContent>
      </Card>
    );
  }

  const scoreValues = chartData.map((point) => point.score);
  const yBounds = resolveAxisBounds(scoreValues);
  const hasMultipleModes = chartData.some((point) => point.mode === "learn") && chartData.some((point) => point.mode === "match");
  const minTickGap = chartWidth < 500 ? 18 : chartWidth < 900 ? 26 : 40;
  const yTickCount = chartWidth < 500 ? 4 : chartWidth < 900 ? 5 : 6;
  const xAxisHeight = chartWidth < 500 ? 26 : 32;

  return (
    <Card className="col-span-full">
      <CardHeader>
        <CardTitle>Performance Trend</CardTitle>
        <CardDescription>Score percentage across your recent sessions</CardDescription>
      </CardHeader>
      <CardContent className="h-75 w-full min-w-0">
        <ResponsiveContainer width="100%" height={300} minWidth={0} onResize={(width) => setChartWidth(width)}>
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted-foreground)/0.2)" />
            <XAxis 
              dataKey="displayDate" 
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12 }}
              stroke="hsl(var(--muted-foreground))"
              minTickGap={minTickGap}
              height={xAxisHeight}
            />
            <YAxis 
              domain={yBounds}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12 }}
              stroke="hsl(var(--muted-foreground))"
              tickFormatter={(value) => `${value}%`}
              tickCount={yTickCount}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: "hsl(var(--background))", 
                borderColor: "hsl(var(--border))",
                borderRadius: "var(--radius)",
                color: "hsl(var(--foreground))"
              }}
              formatter={(value) => [`${value ?? 0}%`, "Score"]}
              labelFormatter={(label) => `Date: ${label}`}
            />
            {hasMultipleModes ? <Legend wrapperStyle={{ fontSize: "12px" }} /> : null}
            <Line 
              type="monotone" 
              dataKey="score" 
              name="Overall"
              stroke="hsl(var(--primary))" 
              strokeWidth={2}
              dot={{ r: 4, fill: "hsl(var(--primary))", strokeWidth: 0 }}
              activeDot={{ r: 6, strokeWidth: 0 }}
            />
            {hasMultipleModes ? (
              <>
                <Line
                  type="monotone"
                  dataKey="learnScore"
                  name="Learn"
                  stroke="hsl(var(--chart-2, 221 83% 53%))"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={false}
                  connectNulls={false}
                />
                <Line
                  type="monotone"
                  dataKey="matchScore"
                  name="Match"
                  stroke="hsl(var(--chart-3, 173 58% 39%))"
                  strokeWidth={2}
                  strokeDasharray="2 5"
                  dot={false}
                  connectNulls={false}
                />
              </>
            ) : null}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
