import { Clock3, FileLock2, ListChecks, ShieldAlert } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ExamModeStrategy, ExamPolicySnapshot, ExamQuestionMode } from "@/lib/exam-types"

interface ExamRulesCardProps {
  policy: ExamPolicySnapshot
  modeStrategy: ExamModeStrategy
  singleMode?: ExamQuestionMode
  expectedDurationMinutes: number
}

export function ExamRulesCard({
  policy,
  modeStrategy,
  singleMode,
  expectedDurationMinutes,
}: ExamRulesCardProps) {
  const timeLimitText = policy.isUntimed
    ? "Untimed assessment (no fixed time limit)."
    : `Time limit: ${policy.timeLimitMinutes ?? 0} minutes.`

  const modeText = modeStrategy === "alternating"
    ? "Question modes alternate between Learn the Flag and Match Meaning to Flag."
    : `All questions use single mode: ${singleMode === "match" ? "Match Meaning to Flag" : "Learn the Flag"}.`

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
          <li>{modeText}</li>
          <li>Official exam retakes are allowed. Every completed attempt is recorded immutably.</li>
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
