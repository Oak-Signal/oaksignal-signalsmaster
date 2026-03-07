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
  questionModePolicy: {
    modeStrategy: ExamModeStrategy
    singleMode?: ExamQuestionMode
  }
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
  sessionIssuedAt?: number | null
  sessionExpiresAt?: number | null
  sessionToken?: string | null
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
  generationSnapshot: ExamGenerationSnapshot | null
  result: {
    totalQuestions: number
    correctCount: number
    scorePercent: number
    passed: boolean
    modeStats?: {
      learn: {
        total: number
        correct: number
        incorrect: number
      }
      match: {
        total: number
        correct: number
        incorrect: number
      }
    }
    categoryStats?: Array<{
      category: string
      total: number
      correct: number
      incorrect: number
    }>
  } | null
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

export type ExamQuestionMode = "learn" | "match"
export type ExamModeStrategy = "alternating" | "single"

export interface ExamQuestionOption {
  id: string
  label: string
  value: string
  imagePath?: string
}

export interface ExamQuestionPublic {
  questionIndex: number
  flagKey: string
  mode: ExamQuestionMode
  options: ExamQuestionOption[]
  prompt: {
    imagePath?: string
    meaning?: string
  }
}

export interface ExamQuestionSubmissionInput {
  examAttemptId: string
  questionIndex: number
  selectedAnswer: string
  sessionToken?: string
}

export interface ExamQuestionSubmissionResult {
  questionIndex: number
  nextQuestionIndex: number | null
  answeredCount: number
  totalQuestions: number
  isExamComplete: boolean
}

export interface ExamAttemptRuntimeProgress {
  examAttemptId: string
  status: "started" | "completed" | "abandoned"
  currentQuestionIndex: number | null
  answeredCount: number
  totalQuestions: number
  remainingCount?: number
  completionPercent?: number
  elapsedMs?: number
  lastAnsweredAt?: number | null
  startedAt: number
  completedAt: number | null
  generationSnapshot: ExamGenerationSnapshot | null
}

export interface ExamGenerationSnapshot {
  seed: number
  questionCount: number
  modeStrategy: ExamModeStrategy
  singleMode?: ExamQuestionMode
  generationStartedAt: number
  generationCompletedAt: number
  generationTimeMs: number
  generationRetryCount: number
  examChecksum: string
  generationVersion: number
}

export type ExamAuditEventType =
  | "generation_started"
  | "generation_completed"
  | "generation_failed"
  | "submission_received"
  | "submission_validated"
  | "submission_rejected"
  | "session_token_issued"
  | "session_token_validated"
  | "session_token_rejected"
  | "connection_lost"
  | "connection_restored"
  | "window_blur"
  | "window_focus"
  | "tab_hidden"
  | "tab_visible"
  | "fullscreen_entered"
  | "fullscreen_exited"
  | "back_navigation_blocked"
  | "restricted_shortcut_blocked"
  | "idle_warning_shown"
  | "idle_timeout_triggered"

export type ExamClientSecurityEventType = Extract<
  ExamAuditEventType,
  | "connection_lost"
  | "connection_restored"
  | "window_blur"
  | "window_focus"
  | "tab_hidden"
  | "tab_visible"
  | "fullscreen_entered"
  | "fullscreen_exited"
  | "back_navigation_blocked"
  | "restricted_shortcut_blocked"
  | "idle_warning_shown"
  | "idle_timeout_triggered"
>

export interface ExamClientSecurityEventInput {
  eventType: ExamClientSecurityEventType
  message: string
  metadata?: Record<string, unknown>
}
