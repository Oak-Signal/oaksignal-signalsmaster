export const ADMIN_EXAMS_DEFAULT_PAGE = 1;
export const ADMIN_EXAMS_DEFAULT_LIMIT = 25;
export const ADMIN_EXAMS_MAX_LIMIT = 100;
export const ADMIN_EXAMS_MIN_SCORE = 0;
export const ADMIN_EXAMS_MAX_SCORE = 100;

export type AdminExamDateRange = "7d" | "30d" | "90d" | "custom";
export type AdminExamPassStatus = "all" | "passed" | "failed";
export type AdminExamAttemptFilter = "all" | "first" | "retake";

export interface AdminRecentExamAttemptItem {
  examResultId: string;
  examAttemptId: string;
  userId: string;
  attemptNumber: number;
  cadetName: string;
  completedAt: number;
  scorePercent: number;
  passed: boolean;
  durationMs: number | null;
}

export interface AdminExamFiltersInput {
  range: AdminExamDateRange;
  customFrom?: string;
  customTo?: string;
  passStatus: AdminExamPassStatus;
  scoreMin: number;
  scoreMax: number;
  cadetNameQuery?: string;
  userIdQuery?: string;
  attemptFilter: AdminExamAttemptFilter;
}

export interface AdminRecentExamAttemptsPagination {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
}

export interface AdminRecentExamAttemptsPayload {
  items: AdminRecentExamAttemptItem[];
  pagination: AdminRecentExamAttemptsPagination;
  generatedAt: number;
}
