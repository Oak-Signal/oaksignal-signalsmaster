"use client"

import { usePathname } from "next/navigation"
import { useQuery } from "convex/react"

import { Id } from "@/convex/_generated/dataModel"
import { api } from "@/convex/_generated/api"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { UserjotWidget } from "@/components/userjot-widget"
import { Toaster } from "@/components/ui/toaster"

interface DashboardShellProps {
  children: React.ReactNode
}

const EXAM_ATTEMPT_ROUTE_PATTERN = /^\/dashboard\/exam\/attempt\/([^/]+)\/?$/

interface ExamAttemptRuntimeStatus {
  status: "started" | "completed" | "abandoned"
}

interface StandardDashboardShellProps {
  children: React.ReactNode
}

function StandardDashboardShell({ children }: StandardDashboardShellProps) {
  return (
    <div className="flex min-h-screen flex-col">
      <UserjotWidget />
      <DashboardHeader />
      <main className="flex-1 space-y-4 p-8 pt-6">{children}</main>
      <Toaster />
    </div>
  )
}

interface FocusedExamShellProps {
  children: React.ReactNode
}

function FocusedExamShell({ children }: FocusedExamShellProps) {
  return (
    <div className="min-h-screen">
      <main className="min-h-screen px-4 py-4 sm:px-6 sm:py-6">{children}</main>
      <Toaster />
    </div>
  )
}

interface ExamAttemptShellResolverProps {
  attemptId: string
  children: React.ReactNode
}

function ExamAttemptShellResolver({ attemptId, children }: ExamAttemptShellResolverProps) {
  const runtimeProgress = useQuery(api.exams.getAttemptRuntimeProgress, {
    examAttemptId: attemptId as Id<"examAttempts">,
  }) as ExamAttemptRuntimeStatus | null | undefined

  if (runtimeProgress?.status === "started" || runtimeProgress === undefined) {
    return <FocusedExamShell>{children}</FocusedExamShell>
  }

  return <StandardDashboardShell>{children}</StandardDashboardShell>
}

export function DashboardShell({ children }: DashboardShellProps) {
  const pathname = usePathname()
  const examAttemptMatch = pathname?.match(EXAM_ATTEMPT_ROUTE_PATTERN)
  const examAttemptId = examAttemptMatch?.[1]

  if (examAttemptId) {
    return (
      <ExamAttemptShellResolver attemptId={examAttemptId}>
        {children}
      </ExamAttemptShellResolver>
    )
  }

  return <StandardDashboardShell>{children}</StandardDashboardShell>
}
