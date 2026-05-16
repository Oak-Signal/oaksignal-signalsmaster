export interface AdminAvailabilityWindow {
  startDate: string
  endDate: string
  startTime: string
  endTime: string
  timeZone?: string
}

export interface AdminSystemConfig {
  _id?: string
  configKey: string
  examEnabled: boolean
  questionCount: number
  passThreshold: number
  availabilityWindow: AdminAvailabilityWindow
  maxRetakes: number
  retakeCooldownHours: number
  maintenanceModeEnabled: boolean
  maintenanceMessage?: string
  updatedBy: string
  updatedAt: number | null
  createdAt: number | null
}

export interface AdminExamTemplate {
  _id: string
  name: string
  description?: string
  settings: {
    examEnabled: boolean
    questionCount: number
    passThreshold: number
    availabilityWindow: AdminAvailabilityWindow
    maxRetakes: number
    retakeCooldownHours: number
  }
  archivedAt?: number
  archivedBy?: string
  updatedBy: string
  createdAt: number
  updatedAt: number
}

export type AdminActionType =
  | "system_config_updated"
  | "maintenance_mode_enabled"
  | "maintenance_mode_disabled"
  | "exam_template_created"
  | "exam_template_updated"
  | "exam_template_archived"

export type AdminActionTargetType = "system_config" | "exam_template"

export type AdminActionOutcome = "success" | "failure"

export interface AdminActionLogItem {
  _id: string
  actorUserId: string
  actorRole: "admin" | "cadet" | "unknown"
  actionType: AdminActionType
  targetType: AdminActionTargetType
  targetId?: string
  outcome: AdminActionOutcome
  message: string
  metadataJson?: string
  createdAt: number
  actorDisplayName: string
  actorEmail: string
}

export interface AdminActionLogPagination {
  page: number
  limit: number
  totalCount: number
  totalPages: number
}

export interface AdminHealthStatus {
  status: "healthy" | "degraded"
  apiUptimeSeconds: number
  apiLatencyMs: number
  dbStatus: "up" | "down"
  dbLatencyMs: number | null
  checkedAt: number
}

export interface ApiSuccessResponse<T> {
  success: true
  data: T
}

export interface ApiErrorResponse {
  success: false
  error?: {
    code?: string
    message?: string
  }
}
