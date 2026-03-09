"use client"

import { Activity, CheckCircle2, Sigma, Users, Info } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

export type AdminExamOverviewStats = {
  totalExamsAdministered: number
  overallPassRatePercent: number
  averageScorePercent: number
  uniqueTestTakers: number
}

interface AdminStatsOverviewProps {
  stats?: AdminExamOverviewStats | null
  isLoading?: boolean
}

const metricCards = [
  {
    key: "totalExamsAdministered",
    title: "Total Exams Administered",
    description: "All-time completed official exam results.",
    tooltip: "Counts immutable completed official exam results across all cadets.",
    icon: Activity,
    valueSuffix: "",
  },
  {
    key: "overallPassRatePercent",
    title: "Overall Pass Rate",
    description: "Passes across all official attempts.",
    tooltip: "Passed attempts divided by total completed official attempts.",
    icon: CheckCircle2,
    valueSuffix: "%",
  },
  {
    key: "averageScorePercent",
    title: "Average Score",
    description: "Mean score across all attempts.",
    tooltip: "Average score percentage from all immutable exam results.",
    icon: Sigma,
    valueSuffix: "%",
  },
  {
    key: "uniqueTestTakers",
    title: "Unique Test Takers",
    description: "Distinct cadets with a completed result.",
    tooltip: "Number of unique users represented in official exam results.",
    icon: Users,
    valueSuffix: "",
  },
] as const

function formatValue(value: number, suffix: string): string {
  if (suffix === "%") {
    return value.toFixed(2) + suffix
  }

  return value.toLocaleString()
}

export function AdminStatsOverview({
  stats,
  isLoading = false,
}: AdminStatsOverviewProps) {
  return (
    <TooltipProvider>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metricCards.map((metric) => {
          const Icon = metric.icon
          const value = stats?.[metric.key] ?? 0

          return (
            <Card key={metric.key} className="border-border/70">
              <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-2">
                <div className="space-y-1">
                  <CardTitle className="text-sm font-medium">{metric.title}</CardTitle>
                </div>
                <div className="flex items-center gap-1">
                  <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
                        aria-label={`About ${metric.title}`}
                      >
                        <Info className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" sideOffset={8} className="max-w-64">
                      {metric.tooltip}
                    </TooltipContent>
                  </Tooltip>
                </div>
              </CardHeader>

              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <div className="text-2xl font-bold tracking-tight">
                    {formatValue(value, metric.valueSuffix)}
                  </div>
                )}
                <p className="mt-1 text-xs text-muted-foreground">{metric.description}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </TooltipProvider>
  )
}
