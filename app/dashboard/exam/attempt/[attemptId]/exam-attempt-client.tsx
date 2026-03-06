"use client"

import Link from "next/link"
import { useQuery } from "convex/react"
import { formatDistanceToNow } from "date-fns"
import { ClipboardCheck, Clock3, Lock, ShieldCheck } from "lucide-react"

import { Id } from "@/convex/_generated/dataModel"
import { api } from "@/convex/_generated/api"
import { ExamAttemptDetail } from "@/lib/exam-types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

interface ExamAttemptClientProps {
  attemptId: Id<"examAttempts">
}

export function ExamAttemptClient({ attemptId }: ExamAttemptClientProps) {
  const attempt = useQuery(api.exams.getAttemptById, { examAttemptId: attemptId }) as
    | ExamAttemptDetail
    | null
    | undefined

  if (attempt === undefined) {
    return (
      <div className="container mx-auto max-w-4xl space-y-6 py-6">
        <Card>
          <CardHeader>
            <CardTitle>Loading official attempt...</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Fetching your official exam attempt details.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (attempt === null) {
    return (
      <div className="container mx-auto max-w-4xl space-y-6 py-6">
        <Card>
          <CardHeader>
            <CardTitle>Attempt unavailable</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This exam attempt does not exist or you do not have access to it.
            </p>
            <Button asChild variant="outline">
              <Link href="/dashboard/exam">Return to Exam Start</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-4xl space-y-6 py-6">
      <div className="space-y-2">
        <Badge variant="destructive" className="uppercase tracking-wide">
          Official Examination
        </Badge>
        <h1 className="text-3xl font-bold tracking-tight">Attempt #{attempt.attemptNumber}</h1>
        <p className="text-muted-foreground">
          Exam attempt initialized {formatDistanceToNow(attempt.startedAt, { addSuffix: true })}.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ShieldCheck className="h-5 w-5" />
            Attempt Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4 text-primary" />
            <span>Status: <span className="font-semibold text-foreground">{attempt.status}</span></span>
          </div>
          <div className="flex items-center gap-2">
            <Clock3 className="h-4 w-4 text-primary" />
            <span>
              Rules reviewed for {Math.round(attempt.rulesViewDurationMs / 1000)} seconds before start.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-primary" />
            <span>
              Policy locked at start: {attempt.policySnapshot.totalQuestions} questions,{" "}
              {attempt.policySnapshot.passThresholdPercent}% pass threshold, no pause/resume.
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Next Step</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Official exam question delivery will be connected in the next implementation batch.
            This route confirms your secure attempt initialization and ownership scope.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button asChild>
              <Link href="/dashboard/exam">Back to Exam Start</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/dashboard/practice">Practice Mode</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
