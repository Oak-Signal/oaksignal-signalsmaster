export type AdminUserRole = "admin" | "cadet";

export type AdminUserStatus =
  | "active"
  | "suspended"
  | "banned"
  | "pending_verification";

export type AdminExamPassFilter = "passed" | "failed" | "no_attempt";

export type AdminPracticeActivityLevel = "none" | "low" | "medium" | "high";

export type AdminRankedParticipation = "participated" | "not_participated";

export type AdminUsersSortBy =
  | "name"
  | "email"
  | "role"
  | "createdAt"
  | "lastActiveAt"
  | "status";

export type AdminSortDirection = "asc" | "desc";

export interface AdminUsersFilters {
  queryText?: string;
  role?: AdminUserRole;
  status?: AdminUserStatus;
  registeredFromMs?: number;
  registeredToMs?: number;
  lastActiveFromMs?: number;
  lastActiveToMs?: number;
  examPassFilter?: AdminExamPassFilter;
  practiceActivityLevel?: AdminPracticeActivityLevel;
  rankedParticipation?: AdminRankedParticipation;
  includeDeleted: boolean;
  sortBy: AdminUsersSortBy;
  sortDirection: AdminSortDirection;
}

export interface AdminUsersListItem {
  userId: string;
  clerkId: string;
  name?: string;
  email: string;
  role: AdminUserRole;
  status: AdminUserStatus;
  avatarUrl?: string;
  createdAt: number;
  lastActiveAt: number;
  isOnline: boolean;
  emailVerifiedAt?: number;
  practiceCompletedSessions: number;
  examPassedCount: number;
  examFailedCount: number;
  rankedRunsCount: number;
}

export interface AdminUsersListPayload {
  items: AdminUsersListItem[];
  pagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
  };
  filtersApplied: AdminUsersFilters;
  generatedAt: number;
}

export interface AdminUsersListResponse {
  success: true;
  data: AdminUsersListPayload;
}

export interface AdminUserWeakArea {
  category: string;
  incorrectRatePercent: number;
}

export interface AdminUserProfilePayload {
  profile: {
    userId: string;
    clerkId: string;
    name?: string;
    email: string;
    role: AdminUserRole;
    status: AdminUserStatus;
    avatarUrl?: string;
    phone?: string;
    contactEmail?: string;
    createdAt: number;
    updatedAt: number;
    emailVerifiedAt?: number;
    lastLoginAt?: number;
    lastActiveAt: number;
    isFlaggedForReview: boolean;
    flaggedForReviewReason?: string;
  };
  activitySummary: {
    totalPracticeSessions: number;
    completedPracticeSessions: number;
    practiceAverageScore: number;
    examAttemptsCount: number;
    examResultsCount: number;
    examPassCount: number;
    examBestScore: number | null;
    rankedRunsCount: number;
    rankedBestScore: number | null;
    totalTimeSpentMs: number;
  };
  progress: {
    flagsMasteredCount: number;
    weakAreas: AdminUserWeakArea[];
    learningStreakDays: number;
    sessionFrequencyPerWeek: number;
  };
  history: {
    roleChanges: Array<{
      _id: string;
      targetUserId: string;
      actorUserId: string;
      previousRole: AdminUserRole;
      newRole: AdminUserRole;
      reason: string;
      metadataJson?: string;
      createdAt: number;
    }>;
    statusChanges: Array<{
      _id: string;
      targetUserId: string;
      actorUserId: string;
      previousStatus: AdminUserStatus;
      newStatus: AdminUserStatus;
      reason: string;
      durationUntil?: number;
      internalNotes?: string;
      metadataJson?: string;
      createdAt: number;
    }>;
    adminNotes: Array<{
      _id: string;
      targetUserId: string;
      authorUserId: string;
      note: string;
      isPinned?: boolean;
      createdAt: number;
      updatedAt: number;
    }>;
    passwordResetRequests: unknown[];
    emailChangeHistory: unknown[];
  };
  activityMonitoring: {
    activityTimeline: Array<{
      _id: string;
      targetUserId: string;
      actorUserId?: string;
      eventType: string;
      metadataJson?: string;
      createdAt: number;
    }>;
    loginHistory: Array<{
      _id: string;
      targetUserId: string;
      eventType: string;
      ipAddress?: string;
      device?: string;
      userAgent?: string;
      sessionId?: string;
      metadataJson?: string;
      createdAt: number;
    }>;
    sessionHistory: unknown[];
    examAttempts: unknown[];
    rankedRuns: Array<{
      _id: string;
      targetUserId: string;
      actorUserId?: string;
      eventType: string;
      metadataJson?: string;
      createdAt: number;
    }>;
  };
  generatedAt: number;
}

export interface AdminUserProfileResponse {
  success: true;
  data: AdminUserProfilePayload;
}

export interface AdminUsersApiErrorResponse {
  success: false;
  error?: {
    code?: string;
    message?: string;
  };
}

export interface AdminUserRoleUpdateRequest {
  nextRole: AdminUserRole;
  reason: string;
  notifyUser?: boolean;
}

export interface AdminUserRoleUpdateResponse {
  success: true;
  data: {
    targetUserId: string;
    changed: boolean;
    previousRole: AdminUserRole;
    newRole: AdminUserRole;
    changedAt: number;
  };
}

export interface AdminUserStatusUpdateRequest {
  nextStatus: AdminUserStatus;
  reason: string;
  durationUntil?: number;
  internalNotes?: string;
  notifyUser?: boolean;
}

export interface AdminUserStatusUpdateResponse {
  success: true;
  data: {
    targetUserId: string;
    changed: boolean;
    previousStatus: AdminUserStatus;
    newStatus: AdminUserStatus;
    changedAt: number;
  };
}

export interface AdminUserNoteCreateRequest {
  note: string;
  isPinned?: boolean;
}

export interface AdminUserNoteCreateResponse {
  success: true;
  data: {
    noteId: string;
    targetUserId: string;
    createdAt: number;
  };
}

export interface AdminUserBulkActionRequest {
  targetUserIds: string[];
  operation: "set_role" | "set_status";
  nextRole?: AdminUserRole;
  nextStatus?: AdminUserStatus;
  reason: string;
  durationUntil?: number;
  internalNotes?: string;
  notifyUser?: boolean;
}

export interface AdminUserBulkActionResponse {
  success: true;
  data: {
    operation: "set_role" | "set_status";
    processed: number;
    changed: number;
    failed: number;
    failures: Array<{
      targetUserId: string;
      reason: string;
    }>;
    generatedAt: number;
  };
}
