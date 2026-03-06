import { Clock3, FileLock2, ListChecks, ShieldAlert } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ExamPolicySnapshot } from "@/lib/exam-types"

interface ExamRulesCardProps {
  policy: ExamPolicySnapshot
  expectedDurationMinutes: number
}

export function ExamRulesCard({ policy, expectedDurationMinutes }: ExamRulesCardProps) {
  const timeLimitText = policy.isUntimed
    ? "Untimed assessment (no fixed time limit)."
    : `Time limit: ${policy.timeLimitMinutes ?? 0} minutes.`

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <FileLock2 className="h-5 w-5" />
          Examination Rules
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex items-start gap-2">
            <ListChecks className="mt-0.5 h-4 w-4 text-primary" />
            <span>Total questions: {policy.totalQuestions} (all flags in database)</span>
          </li>
          <li className="flex items-start gap-2">
            <Clock3 className="mt-0.5 h-4 w-4 text-primary" />
            <span>{timeLimitText}</span>
          </li>
          <li className="flex items-start gap-2">
            <ShieldAlert className="mt-0.5 h-4 w-4 text-primary" />
            <span>Pass threshold: {policy.passThresholdPercent}% required.</span>
          </li>
          <li>Single official attempt policy applies and results are immutable.</li>
          <li>No pause or resume. The exam must be completed in one session.</li>
          <li>No returning to previous questions after proceeding.</li>
          <li>All questions must be answered before submission.</li>
          <li>Academic integrity is required. Unauthorized assistance is prohibited.</li>
        </ul>
        <div className="rounded-md border bg-muted/40 p-3 text-sm">
          Expected duration estimate: <span className="font-semibold">{expectedDurationMinutes} minutes</span>
        </div>
      </CardContent>
    </Card>
  )
}
