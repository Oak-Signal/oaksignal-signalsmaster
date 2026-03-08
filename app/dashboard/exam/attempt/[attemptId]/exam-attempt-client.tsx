"use client"

import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import { useMutation, useQuery } from "convex/react"
import { formatDistanceToNow, format } from "date-fns"

import { Id } from "@/convex/_generated/dataModel"
import { api } from "@/convex/_generated/api"
import {
  ExamClientSecurityEventInput,
  ExamAttemptDetail,
  ExamAttemptRuntimeProgress,
  ExamQuestionPublic,
  ExamQuestionSubmissionResult,
  OfficialExamResult,
} from "@/lib/exam-types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  ExamInProgressHeader,
  ExamQuestionInterface,
  ExamSecurityBanner,
} from "@/components/exam"
import { useExamImagePreload } from "@/hooks/use-exam-image-preload"
import { useExamSecurityMonitor } from "@/hooks/use-exam-security-monitor"
import { useExamKeyboardLockdown } from "@/hooks/use-exam-keyboard-lockdown"

interface ExamAttemptClientProps {
  attemptId: Id<"examAttempts">
}

function formatScorePercent(value: number | null | undefined): string {
  return typeof value === "number" && Number.isFinite(value)
    ? `${value.toFixed(2)}%`
    : "N/A"
}

function isValidNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value)
}

function formatDateTime(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "N/A"
  }
  return format(value, "PPP p")
}

function formatHashSnippet(value: string | null | undefined): string {
  if (!value) {
    return "N/A"
  }
  if (value.length <= 16) {
    return value
  }
  return `${value.slice(0, 8)}...${value.slice(-8)}`
}

function formatResponseTime(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return "Not tracked"
  }

  if (value < 1000) {
    return `${value} ms`
  }

  const seconds = value / 1000
  if (seconds < 60) {
    return `${seconds.toFixed(1)} sec`
  }

  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.round(seconds % 60)
  return `${minutes}m ${remainingSeconds}s`
}

function getOptionLabel(
  options: Array<{ id: string; label: string; value: string }>,
  optionId: string | null | undefined
): string {
  if (!optionId) {
    return "No answer submitted"
  }

  const option = options.find((item) => item.id === optionId)
  if (!option) {
    return optionId
  }

  return option.label?.trim() ? option.label : option.value
}

export function ExamAttemptClient({ attemptId }: ExamAttemptClientProps) {
  const router = useRouter()
  const attempt = useQuery(api.exams.getAttemptById, { examAttemptId: attemptId }) as
    | ExamAttemptDetail
    | null
    | undefined
  const runtimeProgress = useQuery(api.exams.getAttemptRuntimeProgress, {
    examAttemptId: attemptId,
  }) as ExamAttemptRuntimeProgress | null | undefined
  const currentQuestion = useQuery(api.exams.getCurrentAttemptQuestion, {
    examAttemptId: attemptId,
  }) as ExamQuestionPublic | null | undefined
  const preload = useQuery(api.exams.getAttemptPreload, {
    examAttemptId: attemptId,
  }) as { currentQuestionImages: string[]; nextQuestionImages: string[] } | null | undefined
  const submitExamAnswer = useMutation(api.exams.submitExamAnswer)
  const logExamClientEvent = useMutation(api.exams.logExamClientEvent)
  const getMyOfficialResult = useMutation(api.exams.getMyOfficialResult)

  const [officialResult, setOfficialResult] = useState<OfficialExamResult | null | undefined>(undefined)
  const [officialResultError, setOfficialResultError] = useState<string | null>(null)

  const isExamActive = runtimeProgress?.status === "started"

  const logClientSecurityEvent = useCallback(
    (input: ExamClientSecurityEventInput) => {
      let metadataJson: string | undefined
      if (input.metadata) {
        try {
          metadataJson = JSON.stringify(input.metadata)
        } catch {
          metadataJson = undefined
        }
      }

      void logExamClientEvent({
        examAttemptId: attemptId,
        eventType: input.eventType,
        message: input.message,
        metadataJson,
      }).catch(() => undefined)
    },
    [attemptId, logExamClientEvent]
  )

  const securityMonitor = useExamSecurityMonitor({
    enabled: isExamActive,
    onClientEvent: logClientSecurityEvent,
    fullscreenRecommendation: true,
    backNavigationGuard: true,
  })

  const keyboardLockdown = useExamKeyboardLockdown({
    enabled: isExamActive,
    onRestrictedShortcutBlocked: (details) => {
      logClientSecurityEvent({
        eventType: "restricted_shortcut_blocked",
        message: "Blocked restricted keyboard shortcut during active exam.",
        metadata: { ...details },
      })
    },
  })

  useExamImagePreload({
    currentQuestionImages: preload?.currentQuestionImages,
    nextQuestionImages: preload?.nextQuestionImages,
  })

  useEffect(() => {
    if (runtimeProgress?.status !== "completed") {
      return
    }

    let cancelled = false

    void getMyOfficialResult({ examAttemptId: attemptId })
      .then((result) => {
        if (cancelled) {
          return
        }
        setOfficialResult((result as OfficialExamResult | null) ?? null)
        setOfficialResultError(null)
      })
      .catch(() => {
        if (cancelled) {
          return
        }
        setOfficialResult(null)
        setOfficialResultError("Official immutable result record could not be loaded.")
      })

    return () => {
      cancelled = true
    }
  }, [attemptId, getMyOfficialResult, runtimeProgress?.status])

  if (attempt === undefined || runtimeProgress === undefined || currentQuestion === undefined) {
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

  if (attempt === null || runtimeProgress === null) {
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

  const handleSubmitAnswer = async (input: {
    questionIndex: number
    selectedAnswer: string
  }): Promise<ExamQuestionSubmissionResult> => {
    if (!attempt.sessionToken) {
      throw new Error("Session validation is not ready. Please refresh the exam page.")
    }

    return submitExamAnswer({
      examAttemptId: attemptId,
      questionIndex: input.questionIndex,
      selectedAnswer: input.selectedAnswer,
      sessionToken: attempt.sessionToken,
    }) as Promise<ExamQuestionSubmissionResult>
  }

  const result = attempt.result
  const isCompleted = runtimeProgress.status === "completed"
  const effectiveOfficialResult = isCompleted ? officialResult : undefined
  const effectiveOfficialResultError = isCompleted ? officialResultError : null
  const isOfficialResultLoading = isCompleted && effectiveOfficialResult === undefined && !effectiveOfficialResultError
  const hasImmutableOfficialResult = Boolean(effectiveOfficialResult)
  const completionScore = hasImmutableOfficialResult
    ? effectiveOfficialResult?.scorePercent
    : result?.scorePercent
  const completionCorrect = hasImmutableOfficialResult
    ? effectiveOfficialResult?.totalCorrect
    : result?.correctCount
  const completionTotal = hasImmutableOfficialResult
    ? effectiveOfficialResult?.totalQuestions
    : result?.totalQuestions
  const completionPassed = hasImmutableOfficialResult
    ? effectiveOfficialResult?.passed
    : result?.passed
  const completionModeStats = hasImmutableOfficialResult
    ? effectiveOfficialResult?.modeStats
    : result?.modeStats
  const completionCategoryStats = hasImmutableOfficialResult
    ? effectiveOfficialResult?.categoryStats
    : result?.categoryStats
  const hasModeStats = Boolean(completionModeStats)
  const hasCategoryStats = Boolean(completionCategoryStats && completionCategoryStats.length > 0)
  const questionBreakdown = effectiveOfficialResult?.questionBreakdown ?? []
  const hasQuestionBreakdown = questionBreakdown.length > 0

  return (
    <div className="container mx-auto max-w-4xl space-y-6 py-6">
      {isCompleted ? (
        <div className="space-y-2">
          <Badge variant="destructive" className="uppercase tracking-wide">
            Official Examination
          </Badge>
          <h1 className="text-3xl font-bold tracking-tight">Attempt #{attempt.attemptNumber}</h1>
          <p className="text-muted-foreground">
            Exam attempt initialized {formatDistanceToNow(attempt.startedAt, { addSuffix: true })}.
          </p>
        </div>
      ) : (
        <ExamInProgressHeader attemptNumber={attempt.attemptNumber} />
      )}

      {runtimeProgress.status === "started" && (
        <ExamSecurityBanner
          isOffline={securityMonitor.isOffline}
          isWindowFocused={securityMonitor.isWindowFocused}
          isTabVisible={securityMonitor.isTabVisible}
          isFullscreenRecommended={securityMonitor.isFullscreenRecommended}
          backNavigationBlockedCount={securityMonitor.backNavigationBlockedCount}
          restrictedShortcutBlockedCount={keyboardLockdown.blockedShortcutCount}
          onRequestFullscreen={() => {
            void securityMonitor.requestFullscreen()
          }}
        />
      )}

      {runtimeProgress.status !== "completed" && !attempt.sessionToken ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Session validation required</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              A secure exam session token is required before you can continue.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="button" onClick={() => router.refresh()}>
                Refresh Session
              </Button>
              <Button asChild variant="outline">
                <Link href="/dashboard/exam">Return to Exam Start</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : isCompleted ? (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="text-xl">Official Result Certificate</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Immutable result snapshot for attempt #{attempt.attemptNumber}
                </p>
              </div>
              <Badge variant={completionPassed ? "default" : "destructive"} className="px-3 py-1 text-xs uppercase tracking-wide">
                {completionPassed ? "Pass" : "Not Passed"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Completed {attempt.completedAt ? formatDistanceToNow(attempt.completedAt, { addSuffix: true }) : "recently"}.
            </p>

            {isOfficialResultLoading ? (
              <div className="rounded-md border bg-muted/40 p-4 text-sm text-muted-foreground">
                Loading immutable certificate record...
              </div>
            ) : (
              <div className="rounded-lg border bg-muted/30 p-4 md:p-5">
                <div className="grid gap-3 text-sm md:grid-cols-2">
                  <div>
                    <p className="text-muted-foreground">Certificate Number</p>
                    <p className="font-medium">
                      {effectiveOfficialResult?.certificateNumber ?? "Legacy record (no certificate number)"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Cadet Name</p>
                    <p className="font-medium">{effectiveOfficialResult?.userSnapshot.fullName ?? "Name unavailable"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Started</p>
                    <p className="font-medium">{formatDateTime(effectiveOfficialResult?.startedAt ?? attempt.startedAt)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Completed</p>
                    <p className="font-medium">{formatDateTime(effectiveOfficialResult?.completedAt ?? attempt.completedAt ?? null)}</p>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 rounded-md border bg-background p-4 text-sm md:grid-cols-3">
                  <div>
                    <p className="text-muted-foreground">Final Score</p>
                    <p className="text-lg font-semibold">{formatScorePercent(completionScore)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Correct Answers</p>
                    <p className="text-lg font-semibold">
                      {isValidNumber(completionCorrect) ? completionCorrect : "N/A"}/
                      {isValidNumber(completionTotal) ? completionTotal : "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Integrity Hash</p>
                    <p className="text-lg font-semibold">{formatHashSnippet(effectiveOfficialResult?.recordChecksum)}</p>
                  </div>
                </div>

                {!hasImmutableOfficialResult && (
                  <p className="mt-3 text-xs text-amber-700">
                    Immutable result record is not available yet. Rendering legacy completion data.
                  </p>
                )}

                {effectiveOfficialResultError && (
                  <p className="mt-2 text-xs text-amber-700">{effectiveOfficialResultError}</p>
                )}

                {hasModeStats && completionModeStats && (
                  <div className="mt-4 border-t pt-3 text-sm">
                    <p className="mb-2 font-medium">Mode Breakdown</p>
                    <p>
                      Learn: {completionModeStats.learn.correct}/{completionModeStats.learn.total} correct
                    </p>
                    <p>
                      Match: {completionModeStats.match.correct}/{completionModeStats.match.total} correct
                    </p>
                  </div>
                )}

                {hasCategoryStats && completionCategoryStats && (
                  <div className="mt-4 border-t pt-3 text-sm">
                    <p className="mb-2 font-medium">Category Breakdown</p>
                    <div className="space-y-1">
                      {completionCategoryStats.map((item) => (
                        <p key={item.category}>
                          {item.category}: {item.correct}/{item.total} correct
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {hasQuestionBreakdown ? (
                  <div className="mt-4 border-t pt-4">
                    <p className="mb-3 text-sm font-medium">Question-by-Question Review</p>
                    <div className="space-y-3">
                      {questionBreakdown
                        .slice()
                        .sort((a, b) => a.questionIndex - b.questionIndex)
                        .map((question) => {
                          const selectedAnswerLabel = getOptionLabel(question.options, question.selectedAnswer)
                          const correctAnswerLabel = getOptionLabel(question.options, question.correctAnswer)
                          const showCorrectAnswer = question.isCorrect !== true

                          return (
                            <div key={question.questionIndex} className="rounded-md border bg-background p-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-medium">Question {question.questionIndex + 1}</p>
                                  <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                                    {question.mode}
                                  </Badge>
                                </div>
                                <Badge variant={question.isCorrect ? "default" : "destructive"}>
                                  {question.isCorrect ? "Correct" : "Incorrect"}
                                </Badge>
                              </div>

                              <div className="mt-3 flex gap-3">
                                <div className="h-14 w-20 shrink-0 overflow-hidden rounded border bg-muted">
                                  {question.flagImagePath ? (
                                    <Image
                                      src={question.flagImagePath}
                                      alt={`${question.flagName} flag thumbnail`}
                                      width={80}
                                      height={56}
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    <div className="flex h-full items-center justify-center text-[10px] text-muted-foreground">
                                      No image
                                    </div>
                                  )}
                                </div>

                                <div className="min-w-0 flex-1 space-y-1 text-sm">
                                  <p className="font-medium">{question.flagName}</p>
                                  <p className="text-xs text-muted-foreground">Category: {question.category}</p>
                                  <p>
                                    <span className="text-muted-foreground">Your answer:</span>{" "}
                                    <span className={question.isCorrect ? "font-medium" : "font-medium text-destructive"}>
                                      {selectedAnswerLabel}
                                    </span>
                                  </p>
                                  {showCorrectAnswer && (
                                    <p>
                                      <span className="text-muted-foreground">Correct answer:</span>{" "}
                                      <span className="font-medium">{correctAnswerLabel}</span>
                                    </p>
                                  )}
                                  <p className="text-xs text-muted-foreground">
                                    Response time: {formatResponseTime(question.responseTimeMs)}
                                  </p>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 border-t pt-3 text-sm text-muted-foreground">
                    Detailed question review is unavailable for this attempt.
                  </div>
                )}
              </div>
            )}
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
      ) : currentQuestion ? (
        <ExamQuestionInterface
          progress={{
            answeredCount: runtimeProgress.answeredCount,
            remainingCount: runtimeProgress.remainingCount ?? (
              runtimeProgress.totalQuestions - runtimeProgress.answeredCount
            ),
            totalQuestions: runtimeProgress.totalQuestions,
            completionPercent: runtimeProgress.completionPercent ?? 0,
            elapsedMs: runtimeProgress.elapsedMs ?? 0,
          }}
          question={currentQuestion}
          onSubmitAnswer={handleSubmitAnswer}
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Preparing question delivery</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Your exam is active, but question data is not yet available. Please refresh.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
