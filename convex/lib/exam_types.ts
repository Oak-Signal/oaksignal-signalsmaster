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
