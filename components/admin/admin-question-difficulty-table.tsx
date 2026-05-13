import type { AdminQuestionDifficultyRow } from "@/lib/admin-analytics-types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface AdminQuestionDifficultyTableProps {
  data: AdminQuestionDifficultyRow[]
}

export function AdminQuestionDifficultyTable({ data }: AdminQuestionDifficultyTableProps) {
  const rows = data.slice(0, 20)

  return (
    <Card className="border-border/70">
      <CardHeader>
        <CardTitle>Question Difficulty Analysis</CardTitle>
        <CardDescription>Lowest pass-rate questions in the selected range.</CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No question-level difficulty data is available.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-150 text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Question Key</th>
                  <th className="py-2 pr-3 font-medium">Flag</th>
                  <th className="py-2 pr-3 font-medium">Mode</th>
                  <th className="py-2 pr-3 font-medium">Attempts</th>
                  <th className="py-2 pr-3 font-medium">Correct</th>
                  <th className="py-2 pr-3 font-medium">Pass Rate</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.questionKey} className="border-b border-border/50">
                    <td className="py-2 pr-3 font-medium">{row.questionKey}</td>
                    <td className="py-2 pr-3">{row.flagName}</td>
                    <td className="py-2 pr-3 uppercase">{row.mode}</td>
                    <td className="py-2 pr-3">{row.attempts.toLocaleString()}</td>
                    <td className="py-2 pr-3">{row.correct.toLocaleString()}</td>
                    <td className="py-2 pr-3">{row.passRatePercent.toFixed(2)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
