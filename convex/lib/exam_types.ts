import { Id } from "../_generated/dataModel";

export type ExamQuestionMode = "learn" | "match";
export type ExamModeStrategy = "alternating" | "single";

export interface ExamQuestionOption {
  id: string;
  label: string;
  value: string;
  imagePath?: string;
}

export interface ExamQuestionRecord {
  examAttemptId: Id<"examAttempts">;
  userId: Id<"users">;
  questionIndex: number;
  flagId: Id<"flags">;
  flagKey: string;
  mode: ExamQuestionMode;
  options: ExamQuestionOption[];
  correctAnswer: string;
  userAnswer: string | null;
  answeredAt?: number;
  isCorrect?: boolean;
  checksum: string;
}

export interface ExamGenerationSnapshot {
  seed: number;
  questionCount: number;
  modeStrategy: ExamModeStrategy;
  singleMode?: ExamQuestionMode;
  generationStartedAt: number;
  generationCompletedAt: number;
  generationTimeMs: number;
  generationRetryCount: number;
  examChecksum: string;
  generationVersion: number;
}

export interface ExamFlagSnapshotItem {
  flagId: Id<"flags">;
  key: string;
  name: string;
  meaning: string;
  imagePath: string;
  type:
    | "flag-letter"
    | "flag-number"
    | "pennant-number"
    | "special-pennant"
    | "substitute";
  category: string;
  order: number;
  difficulty?: "beginner" | "intermediate" | "advanced";
}

export interface ExamSettingsSnapshot {
  modeStrategy: ExamModeStrategy;
  singleMode?: ExamQuestionMode;
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
  | "idle_timeout_triggered";

export type ResultAccessActorRole = "cadet" | "admin" | "instructor" | "auditor";

export type ResultAccessType =
  | "result_read"
  | "result_list"
  | "result_verify"
  | "result_access_denied";

export interface OfficialExamQuestionResultRecord {
  questionIndex: number;
  flagId: Id<"flags">;
  flagKey: string;
  flagName: string;
  flagImagePath: string;
  category: string;
  mode: ExamQuestionMode;
  options: ExamQuestionOption[];
  selectedAnswer: string | null;
  correctAnswer: string;
  isCorrect: boolean;
  answeredAt?: number;
  responseTimeMs?: number;
  questionChecksum: string;
}

export interface OfficialExamResultRecord {
  examAttemptId: Id<"examAttempts">;
  userId: Id<"users">;
  immutable: true;
  immutableAt: number;
  certificateNumber: string;
  resultVersion: number;
  userSnapshot: {
    userId: Id<"users">;
    fullName: string;
    roleAtExam: "cadet" | "admin" | "instructor";
  };
  attemptNumber: number;
  startedAt: number;
  completedAt: number;
  totalQuestions: number;
  totalCorrect: number;
  scorePercent: number;
  passThresholdPercent: number;
  passed: boolean;
  examModesUsed: ExamQuestionMode[];
  modeStats?: {
    learn: {
      total: number;
      correct: number;
      incorrect: number;
    };
    match: {
      total: number;
      correct: number;
      incorrect: number;
    };
  };
  categoryStats?: Array<{
    category: string;
    total: number;
    correct: number;
    incorrect: number;
  }>;
  flagDatabaseSnapshot: {
    generationVersion: number;
    examChecksum: string;
    questionCount: number;
    modeStrategy: ExamModeStrategy;
    singleMode?: ExamQuestionMode;
    generationStartedAt: number;
    generationCompletedAt: number;
    generationTimeMs: number;
    generationRetryCount: number;
  };
  questionBreakdown: OfficialExamQuestionResultRecord[];
  recordChecksum: string;
  signatureAlgorithm: string;
  signature: string;
  createdAt: number;
}
