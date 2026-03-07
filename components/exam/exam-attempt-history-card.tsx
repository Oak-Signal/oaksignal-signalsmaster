import { formatDistanceToNow } from "date-fns"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ExamAttemptHistoryItem } from "@/lib/exam-types"

interface ExamAttemptHistoryCardProps {
  attempts: ExamAttemptHistoryItem[] | null | undefined
}

function getStatusBadgeVariant(status: ExamAttemptHistoryItem["status"]) {
  if (status === "completed") {
    return "default"
  }
  if (status === "abandoned") {
    return "secondary"
  }
  return "outline"
}

export function ExamAttemptHistoryCard({ attempts }: ExamAttemptHistoryCardProps) {
  if (attempts === undefined) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Attempt History</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading attempt history...</p>
        </CardContent>
      </Card>
    )
  }

  if (!attempts || attempts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Attempt History</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No official exam attempts on record yet.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Attempt History</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {attempts.map((attempt) => (
          <div key={attempt.examAttemptId} className="rounded-md border p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="font-medium">Attempt #{attempt.attemptNumber}</p>
              <Badge variant={getStatusBadgeVariant(attempt.status)}>
                {attempt.status}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Started{" "}
              {formatDistanceToNow(attempt.startedAt, {
                addSuffix: true,
              })}
            </p>
            {attempt.scorePercent !== null && (
              <p className="mt-1 text-sm text-muted-foreground">
                Score: {attempt.scorePercent.toFixed(2)}% {attempt.passed ? "(Passed)" : "(Not Passed)"}
              </p>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
