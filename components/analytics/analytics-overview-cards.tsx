import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AnalyticsSummary } from "@/lib/results-types";
import { formatDistanceStrict } from "date-fns";
import { Trophy, Target, Clock, Flame, Activity } from "lucide-react";

interface AnalyticsOverviewCardsProps {
  summary: AnalyticsSummary | null | undefined;
}

export function AnalyticsOverviewCards({ summary }: AnalyticsOverviewCardsProps) {
  if (!summary) return null;

  const cards = [
    {
      title: "Total Sessions",
      value: summary.totalSessions.toString(),
      icon: Activity,
      description: "Sessions completed",
      color: "text-blue-500",
    },
    {
      title: "Avg. Score",
      value: `${summary.averageScore}%`,
      icon: Target,
      description: "Across all sessions",
      color: "text-green-500",
    },
    {
      title: "Best Score",
      value: `${summary.bestScore}%`,
      icon: Trophy,
      description: "Personal record",
      color: "text-yellow-500",
    },
    {
      title: "Time Practiced",
      value: summary.totalTimePracticed > 0 
        ? formatDistanceStrict(0, summary.totalTimePracticed)
        : "0 m",
      icon: Clock,
      description: "Total time spent",
      color: "text-purple-500",
    },
    {
      title: "Avg Session Time",
      value: summary.avgSessionTime > 0
        ? formatDistanceStrict(0, summary.avgSessionTime)
        : "0 m",
      icon: Clock,
      description: "Per completed session",
      color: "text-indigo-500",
    },
    {
      title: "Best Streak",
      value: summary.longestStreak.toString(),
      icon: Flame,
      description: "Days in a row",
      color: "text-orange-500",
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
      {cards.map((card, i) => (
        <Card key={i}>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
            <card.icon className={`w-4 h-4 ${card.color}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{card.value}</div>
            <p className="text-xs text-muted-foreground">{card.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
