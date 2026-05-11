export const ADMIN_EXAMS_DEFAULT_PAGE = 1;
export const ADMIN_EXAMS_DEFAULT_LIMIT = 25;
export const ADMIN_EXAMS_MAX_LIMIT = 100;

export interface AdminRecentExamAttemptItem {
  examResultId: string;
  examAttemptId: string;
  cadetName: string;
  completedAt: number;
  scorePercent: number;
  passed: boolean;
  durationMs: number | null;
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
