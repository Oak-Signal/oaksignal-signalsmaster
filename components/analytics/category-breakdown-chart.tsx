"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CategoryBreakdown } from "@/lib/results-types";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface CategoryBreakdownChartProps {
  data: CategoryBreakdown[] | undefined | null;
}

export function CategoryBreakdownChart({ data }: CategoryBreakdownChartProps) {
  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Category Mastery</CardTitle>
          <CardDescription>Success rates by flag type</CardDescription>
        </CardHeader>
        <CardContent className="h-62.5 flex items-center justify-center text-sm text-muted-foreground">
          No category data available yet.
        </CardContent>
      </Card>
    );
  }

  // Define colors based on success rate
  const getColor = (rate: number) => {
    if (rate >= 90) return "hsl(var(--success, 142 71% 45%))"; // Green-ish
    if (rate >= 70) return "hsl(var(--warning, 45 93% 47%))"; // Yellow-ish
    return "hsl(var(--destructive, 0 84% 60%))"; // Red-ish
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Category Mastery</CardTitle>
        <CardDescription>Success rates by flag type</CardDescription>
      </CardHeader>
      <CardContent className="h-62.5 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="hsl(var(--muted-foreground)/0.2)" />
            <XAxis 
              type="number" 
              domain={[0, 100]} 
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12 }}
              stroke="hsl(var(--muted-foreground))"
              tickFormatter={(value) => `${value}%`}
            />
            <YAxis 
              dataKey="category" 
              type="category"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12 }}
              stroke="hsl(var(--muted-foreground))"
              width={100}
            />
            <Tooltip 
              cursor={{ fill: "hsl(var(--muted)/0.5)" }}
              contentStyle={{ 
                backgroundColor: "hsl(var(--background))", 
                borderColor: "hsl(var(--border))",
                borderRadius: "var(--radius)",
                color: "hsl(var(--foreground))"
              }}
              formatter={(value, name) => [
                name === "successRate" ? `${value ?? 0}%` : (value ?? 0), 
                name === "successRate" ? "Success Rate" : "Attempts"
              ]}
            />
            <Bar dataKey="successRate" radius={[0, 4, 4, 0]} maxBarSize={40}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getColor(entry.successRate)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
