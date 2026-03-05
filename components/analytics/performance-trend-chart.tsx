"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PerformanceTrendPoint } from "@/lib/results-types";
import { format } from "date-fns";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface PerformanceTrendChartProps {
  data: PerformanceTrendPoint[] | null | undefined;
}

export function PerformanceTrendChart({ data }: PerformanceTrendChartProps) {
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

  // Format data for recharts
  const chartData = data.map(point => ({
    ...point,
    displayDate: format(new Date(point.date), "MMM d, HH:mm"),
  }));

  return (
    <Card className="col-span-full">
      <CardHeader>
        <CardTitle>Performance Trend</CardTitle>
        <CardDescription>Score percentage across your recent sessions</CardDescription>
      </CardHeader>
      <CardContent className="h-75 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted-foreground)/0.2)" />
            <XAxis 
              dataKey="displayDate" 
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12 }}
              stroke="hsl(var(--muted-foreground))"
              minTickGap={30}
            />
            <YAxis 
              domain={[0, 100]} 
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12 }}
              stroke="hsl(var(--muted-foreground))"
              tickFormatter={(value) => `${value}%`}
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
            <Line 
              type="monotone" 
              dataKey="score" 
              stroke="hsl(var(--primary))" 
              strokeWidth={2}
              dot={{ r: 4, fill: "hsl(var(--primary))", strokeWidth: 0 }}
              activeDot={{ r: 6, strokeWidth: 0 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
