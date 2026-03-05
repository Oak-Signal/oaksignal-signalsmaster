"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from "recharts";

interface ModeBreakdownChartProps {
  learnSessions: number;
  matchSessions: number;
  learnSuccessRate: number;
  matchSuccessRate: number;
}

export function ModeBreakdownChart({
  learnSessions,
  matchSessions,
  learnSuccessRate,
  matchSuccessRate,
}: ModeBreakdownChartProps) {
  const total = learnSessions + matchSessions;
  
  if (total === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Practice Modes</CardTitle>
          <CardDescription>Success rate by mode</CardDescription>
        </CardHeader>
        <CardContent className="h-62.5 flex items-center justify-center text-sm text-muted-foreground">
          No mode data available yet.
        </CardContent>
      </Card>
    );
  }

  const data = [
    { mode: "Learn", successRate: learnSuccessRate, sessions: learnSessions },
    { mode: "Match", successRate: matchSuccessRate, sessions: matchSessions },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Practice Modes</CardTitle>
        <CardDescription>Success rate by mode</CardDescription>
      </CardHeader>
      <CardContent className="h-62.5 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted-foreground)/0.2)" />
            <XAxis
              dataKey="mode"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12 }}
              stroke="hsl(var(--muted-foreground))"
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
              formatter={(value, _name, item) => [
                `${value ?? 0}%`,
                `${item?.payload?.sessions ?? 0} sessions`,
              ]}
              contentStyle={{ 
                backgroundColor: "hsl(var(--background))", 
                borderColor: "hsl(var(--border))",
                borderRadius: "var(--radius)",
                color: "hsl(var(--foreground))"
              }}
            />
            <Bar dataKey="successRate" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={50} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
