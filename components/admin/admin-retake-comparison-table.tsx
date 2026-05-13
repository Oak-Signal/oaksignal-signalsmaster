import type { AdminRetakeComparison } from "@/lib/admin-analytics-types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface AdminRetakeComparisonTableProps {
  data: AdminRetakeComparison
}

const rows = [
  {
    key: "first",
    label: "First Attempt",
  },
  {
    key: "retakes",
    label: "Retakes",
  },
] as const

export function AdminRetakeComparisonTable({ data }: AdminRetakeComparisonTableProps) {
  return (
    <Card className="border-border/70">
      <CardHeader>
        <CardTitle>First Attempt vs Retakes</CardTitle>
        <CardDescription>Compare pass outcomes and score performance across attempt types.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full min-w-125 text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 pr-3 font-medium">Attempt Type</th>
                <th className="py-2 pr-3 font-medium">Attempts</th>
                <th className="py-2 pr-3 font-medium">Passed</th>
                <th className="py-2 pr-3 font-medium">Failed</th>
                <th className="py-2 pr-3 font-medium">Pass Rate</th>
                <th className="py-2 pr-3 font-medium">Avg Score</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const summary = row.key === "first" ? data.firstAttempt : data.retakes

                return (
                  <tr key={row.key} className="border-b border-border/50">
                    <td className="py-2 pr-3 font-medium">{row.label}</td>
                    <td className="py-2 pr-3">{summary.attempts.toLocaleString()}</td>
                    <td className="py-2 pr-3">{summary.passed.toLocaleString()}</td>
                    <td className="py-2 pr-3">{summary.failed.toLocaleString()}</td>
                    <td className="py-2 pr-3">{summary.passRatePercent.toFixed(2)}%</td>
                    <td className="py-2 pr-3">{summary.averageScorePercent.toFixed(2)}%</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
