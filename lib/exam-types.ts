export interface ExamPolicySnapshot {
  passThresholdPercent: number
  totalQuestions: number
  isUntimed: boolean
  timeLimitMinutes?: number
  singleAttemptOnly: boolean
  noPauseResume: boolean
  noBacktracking: boolean
  requiresAllAnswers: boolean
}

export interface ExamStartContext {
  examPolicy: ExamPolicySnapshot
  expectedDurationMinutes: number
  minimumRulesViewDurationMs: number
  prerequisite: {
    minimumPracticeSessions: number
    userPracticeSessions: number
    userPracticeAveragePercent: number
    met: boolean
  }
  eligibility: {
    canStart: boolean
    blockers: string[]
  }
  systemRequirements: {
    stableInternetRequired: boolean
    recommendedBrowsers: string[]
  }
  proctorInfo: {
    instructorName: string
    scheduledStartAt: number
    instructions?: string
  } | null
  motivationalMessage: string
  attemptSummary: {
    hasOfficialAttempt: boolean
    latestAttemptStatus: "started" | "completed" | "abandoned" | null
    latestStartedAt: number | null
  }
}

export interface ExamAttemptHistoryItem {
  examAttemptId: string
  attemptNumber: number
  status: "started" | "completed" | "abandoned"
  startedAt: number
  completedAt: number | null
  scorePercent: number | null
  passed: boolean | null
}

export interface ExamAttemptDetail {
  examAttemptId: string
  attemptNumber: number
  status: "started" | "completed" | "abandoned"
  startedAt: number
  completedAt: number | null
  rulesAcknowledgedAt: number
  readinessAcknowledgedAt: number
  rulesViewDurationMs: number
  policySnapshot: ExamPolicySnapshot
  prerequisiteSnapshot: {
    minimumPracticeSessionsRequired: number
    userPracticeSessions: number
    userPracticeAveragePercent: number
  }
  systemSnapshot: {
    ipAddress?: string
    userAgent?: string
    browserFamily?: string
    browserVersion?: string
    browserSupported: boolean
    stableInternetConfirmed: boolean
  }
}

export interface StartExamApiSuccess {
  success: true
  data: {
    examAttemptId: string
    startedAt: number
  }
}

export interface StartExamApiError {
  success: false
  error: {
    code: string
    message: string
  }
}

export type StartExamApiResponse = StartExamApiSuccess | StartExamApiError
