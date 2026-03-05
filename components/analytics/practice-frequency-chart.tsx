"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { WeeklyFrequency } from "@/lib/results-types";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface PracticeFrequencyChartProps {
  data: WeeklyFrequency[] | undefined | null;
}

export function PracticeFrequencyChart({ data }: PracticeFrequencyChartProps) {
  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Practice Frequency</CardTitle>
          <CardDescription>Sessions completed per week</CardDescription>
        </CardHeader>
        <CardContent className="h-62.5 flex items-center justify-center text-sm text-muted-foreground">
          No frequency data available yet.
        </CardContent>
      </Card>
    );
  }

  // Format the label slightly to look better if needed
  const formattedData = data.map(d => {
    // d.week is typically like "2026-W07" (ISO week)
    // We can simplify this to just the ISO string or strip the year for brevity
    const shortWeek = d.week.split('-')[1] || d.week;
    return {
      ...d,
      displayWeek: `Week ${shortWeek.replace('W', '')}`
    };
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Practice Frequency</CardTitle>
        <CardDescription>Sessions completed over recent weeks</CardDescription>
      </CardHeader>
      <CardContent className="h-62.5 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={formattedData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted-foreground)/0.2)" />
            <XAxis 
              dataKey="displayWeek" 
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
            <Tooltip 
              cursor={{ fill: "hsl(var(--muted)/0.5)" }}
              contentStyle={{ 
                backgroundColor: "hsl(var(--background))", 
                borderColor: "hsl(var(--border))",
                borderRadius: "var(--radius)",
                color: "hsl(var(--foreground))"
              }}
              formatter={(value) => [value ?? 0, "Sessions"]}
            />
            <Bar 
              dataKey="count" 
              fill="hsl(var(--primary))" 
              radius={[4, 4, 0, 0]} 
              maxBarSize={40}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
