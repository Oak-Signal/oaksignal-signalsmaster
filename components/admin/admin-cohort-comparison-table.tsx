import type { AdminCohortComparison } from "@/lib/admin-analytics-types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface AdminCohortComparisonTableProps {
  data: AdminCohortComparison
  rangeLabel: string
  compareRangeLabel: string
}

export function AdminCohortComparisonTable({
  data,
  rangeLabel,
  compareRangeLabel,
}: AdminCohortComparisonTableProps) {
  const hasRows = data.current.rows.length > 0

  return (
    <Card className="border-border/70">
      <CardHeader>
        <CardTitle>Cohort Comparison</CardTitle>
        <CardDescription>
          Compare cohort outcomes between {rangeLabel} and {compareRangeLabel} windows.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!hasRows ? (
          <p className="text-sm text-muted-foreground">No cohort comparison data available.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-150 text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Group</th>
                  <th className="py-2 pr-3 font-medium">Current Attempts</th>
                  <th className="py-2 pr-3 font-medium">Current Pass Rate</th>
                  <th className="py-2 pr-3 font-medium">Comparison Attempts</th>
                  <th className="py-2 pr-3 font-medium">Comparison Pass Rate</th>
                </tr>
              </thead>
              <tbody>
                {data.current.rows.map((currentRow) => {
                  const comparisonRow = data.comparison.rows.find((row) => row.group === currentRow.group)

                  return (
                    <tr key={currentRow.group} className="border-b border-border/50">
                      <td className="py-2 pr-3 font-medium">{currentRow.group}</td>
                      <td className="py-2 pr-3">{currentRow.attempts.toLocaleString()}</td>
                      <td className="py-2 pr-3">{currentRow.passRatePercent.toFixed(2)}%</td>
                      <td className="py-2 pr-3">{comparisonRow?.attempts.toLocaleString() ?? "0"}</td>
                      <td className="py-2 pr-3">
                        {comparisonRow ? `${comparisonRow.passRatePercent.toFixed(2)}%` : "0.00%"}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
