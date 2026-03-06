import { AlertTriangle, CheckCircle2, Target, Trophy } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface ExamPrerequisitesCardProps {
  minimumPracticeSessions: number
  userPracticeSessions: number
  userPracticeAveragePercent: number
  passThresholdPercent: number
  blockers: string[]
}

export function ExamPrerequisitesCard({
  minimumPracticeSessions,
  userPracticeSessions,
  userPracticeAveragePercent,
  passThresholdPercent,
  blockers,
}: ExamPrerequisitesCardProps) {
  const meetsPracticeRequirement = userPracticeSessions >= minimumPracticeSessions

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Eligibility & Prerequisites</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Completed Practice Sessions</p>
            <p className="mt-1 text-2xl font-bold">{userPracticeSessions}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Required minimum: {minimumPracticeSessions}
            </p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Practice Average</p>
            <p className="mt-1 text-2xl font-bold">{userPracticeAveragePercent}%</p>
            <p className="mt-1 text-xs text-muted-foreground">Based on completed practice sessions.</p>
          </div>
        </div>

        <div
          className={`rounded-md border p-3 text-sm ${
            meetsPracticeRequirement
              ? "border-green-500/30 bg-green-500/10"
              : "border-amber-500/30 bg-amber-500/10"
          }`}
        >
          <div className="flex items-start gap-2">
            {meetsPracticeRequirement ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 text-green-600" />
            ) : (
              <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600" />
            )}
            <span>
              {meetsPracticeRequirement
                ? "Practice prerequisite met."
                : "Practice prerequisite not yet met."}
            </span>
          </div>
        </div>

        {blockers.length > 0 && (
          <div className="space-y-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm">
            <p className="font-semibold text-destructive">Current blockers</p>
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              {blockers.map((blocker) => (
                <li key={blocker}>{blocker}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex items-center gap-2 rounded-md border p-3 text-sm text-muted-foreground">
            <Trophy className="h-4 w-4 text-primary" />
            Maintain steady practice performance.
          </div>
          <div className="flex items-center gap-2 rounded-md border p-3 text-sm text-muted-foreground">
            <Target className="h-4 w-4 text-primary" />
            Aim confidently for {passThresholdPercent}% and above.
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
