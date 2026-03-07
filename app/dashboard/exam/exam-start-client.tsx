"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useQuery } from "convex/react"

import { api } from "@/convex/_generated/api"
import {
  ExamAttemptHistoryItem,
  ExamStartContext,
  StartExamApiResponse,
} from "@/lib/exam-types"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ExamAttemptHistoryCard,
  ExamPrerequisitesCard,
  ExamRulesCard,
  ExamStartConfirmDialog,
  ExamStartForm,
  NotReadyActions,
  OfficialExamHeader,
  SystemRequirementsCard,
} from "@/components/exam"

function isStartExamApiResponse(value: unknown): value is StartExamApiResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "success" in value &&
    typeof (value as { success: unknown }).success === "boolean"
  )
}

export function ExamStartClient() {
  const router = useRouter()
  const { toast } = useToast()

  const startContext = useQuery(api.exams.getExamStartContext) as
    | ExamStartContext
    | null
    | undefined
  const attemptHistory = useQuery(api.exams.getAttemptHistory, { limit: 5 }) as
    | ExamAttemptHistoryItem[]
    | null
    | undefined

  const [rulesAcknowledged, setRulesAcknowledged] = useState(false)
  const [readinessAcknowledged, setReadinessAcknowledged] = useState(false)
  const [stableInternetConfirmed, setStableInternetConfirmed] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now())
    }, 500)

    return () => clearInterval(interval)
  }, [])

  const viewStartTime = useMemo(() => Date.now(), [])

  if (startContext === undefined) {
    return (
      <div className="container mx-auto max-w-5xl space-y-6 py-6">
        <Card>
          <CardHeader>
            <CardTitle>Loading exam setup...</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Gathering your eligibility and official exam policy details.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (startContext === null) {
    return (
      <div className="container mx-auto max-w-5xl space-y-6 py-6">
        <Card>
          <CardHeader>
            <CardTitle>Unable to load exam setup</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Please sign in again to continue.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const elapsedMs = now - viewStartTime
  const minRulesViewRemainingMs = Math.max(
    0,
    startContext.minimumRulesViewDurationMs - elapsedMs
  )

  const canStartExam =
    startContext.eligibility.canStart &&
    rulesAcknowledged &&
    readinessAcknowledged &&
    minRulesViewRemainingMs === 0
  const questionModePolicy = startContext.questionModePolicy ?? {
    modeStrategy: "alternating" as const,
    singleMode: undefined,
  }

  const handleStartClick = () => {
    if (!canStartExam || isSubmitting) {
      return
    }
    setConfirmDialogOpen(true)
  }

  const handleConfirmStart = async () => {
    setIsSubmitting(true)
    try {
      const response = await fetch("/api/exam/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          rulesAcknowledged,
          readinessAcknowledged,
          rulesViewDurationMs: elapsedMs,
          stableInternetConfirmed,
        }),
      })

      const data: unknown = await response.json()
      if (!isStartExamApiResponse(data)) {
        throw new Error("Unexpected response from exam start endpoint.")
      }

      if (!response.ok || !data.success) {
        const errorMessage =
          !data.success && data.error.message
            ? data.error.message
            : "Unable to start the official exam."
        throw new Error(errorMessage)
      }

      toast({
        title: "Official exam started",
        description: `Attempt ${data.data.examAttemptId} has been initialized.`,
      })

      setConfirmDialogOpen(false)
      router.push(`/dashboard/exam/attempt/${data.data.examAttemptId}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Please try again."
      toast({
        title: "Failed to start exam",
        description: message,
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="container mx-auto max-w-5xl space-y-6 py-6">
      <OfficialExamHeader motivationalMessage={startContext.motivationalMessage} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <ExamRulesCard
            policy={startContext.examPolicy}
            modeStrategy={questionModePolicy.modeStrategy}
            singleMode={questionModePolicy.singleMode}
            expectedDurationMinutes={startContext.expectedDurationMinutes}
          />
          <ExamPrerequisitesCard
            minimumPracticeSessions={startContext.prerequisite.minimumPracticeSessions}
            userPracticeSessions={startContext.prerequisite.userPracticeSessions}
            userPracticeAveragePercent={startContext.prerequisite.userPracticeAveragePercent}
            passThresholdPercent={startContext.examPolicy.passThresholdPercent}
            blockers={startContext.eligibility.blockers}
          />
          <SystemRequirementsCard
            stableInternetRequired={startContext.systemRequirements.stableInternetRequired}
            recommendedBrowsers={startContext.systemRequirements.recommendedBrowsers}
            proctorInfo={startContext.proctorInfo}
          />
          <ExamStartForm
            rulesAcknowledged={rulesAcknowledged}
            readinessAcknowledged={readinessAcknowledged}
            stableInternetConfirmed={stableInternetConfirmed}
            onRulesAcknowledgedChange={setRulesAcknowledged}
            onReadinessAcknowledgedChange={setReadinessAcknowledged}
            onStableInternetConfirmedChange={setStableInternetConfirmed}
            onStartClick={handleStartClick}
            disabled={!canStartExam}
            isSubmitting={isSubmitting}
            minRulesViewRemainingMs={minRulesViewRemainingMs}
          />
          <NotReadyActions />
        </div>

        <div className="space-y-6">
          <ExamAttemptHistoryCard attempts={attemptHistory} />
        </div>
      </div>

      <ExamStartConfirmDialog
        open={confirmDialogOpen}
        onOpenChange={setConfirmDialogOpen}
        onConfirm={handleConfirmStart}
        isSubmitting={isSubmitting}
      />
    </div>
  )
}
