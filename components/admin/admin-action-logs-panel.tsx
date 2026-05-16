"use client"

import { useCallback, useEffect, useState } from "react"
import { format } from "date-fns"

import {
  AdminActionLogItem,
  AdminActionLogPagination,
  AdminActionOutcome,
  AdminActionTargetType,
  AdminActionType,
  ApiErrorResponse,
  ApiSuccessResponse,
} from "@/lib/admin-system-management-types"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface LogsPayload {
  items: AdminActionLogItem[]
  pagination: AdminActionLogPagination
  generatedAt: number
}

const ACTION_OPTIONS: Array<{ value: "all" | AdminActionType; label: string }> = [
  { value: "all", label: "All actions" },
  { value: "system_config_updated", label: "System config updated" },
  { value: "maintenance_mode_enabled", label: "Maintenance enabled" },
  { value: "maintenance_mode_disabled", label: "Maintenance disabled" },
  { value: "exam_template_created", label: "Template created" },
  { value: "exam_template_updated", label: "Template updated" },
  { value: "exam_template_archived", label: "Template archived" },
]

const TARGET_OPTIONS: Array<{ value: "all" | AdminActionTargetType; label: string }> = [
  { value: "all", label: "All targets" },
  { value: "system_config", label: "System config" },
  { value: "exam_template", label: "Exam template" },
]

const OUTCOME_OPTIONS: Array<{ value: "all" | AdminActionOutcome; label: string }> = [
  { value: "all", label: "All outcomes" },
  { value: "success", label: "Success" },
  { value: "failure", label: "Failure" },
]

export function AdminActionLogsPanel() {
  const [logs, setLogs] = useState<LogsPayload | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const [page, setPage] = useState(1)
  const [queryText, setQueryText] = useState("")
  const [actionType, setActionType] = useState<"all" | AdminActionType>("all")
  const [targetType, setTargetType] = useState<"all" | AdminActionTargetType>("all")
  const [outcome, setOutcome] = useState<"all" | AdminActionOutcome>("all")

  const fetchLogs = useCallback(async () => {
    setIsLoading(true)

    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "25",
      })

      if (queryText.trim().length > 0) {
        params.set("queryText", queryText.trim())
      }

      if (actionType !== "all") {
        params.set("actionType", actionType)
      }

      if (targetType !== "all") {
        params.set("targetType", targetType)
      }

      if (outcome !== "all") {
        params.set("outcome", outcome)
      }

      const response = await fetch(`/api/admin/audit?${params.toString()}`, {
        method: "GET",
        cache: "no-store",
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
        },
      })

      const body = (await response.json()) as
        | ApiSuccessResponse<LogsPayload>
        | ApiErrorResponse

      if (!response.ok) {
        const message =
          body && "error" in body && body.error?.message
            ? body.error.message
            : "Unable to load admin action logs."
        throw new Error(message)
      }

      if (!body || !("success" in body) || !body.success || !("data" in body)) {
        throw new Error("Unexpected admin action logs response.")
      }

      setLogs(body.data)
      setErrorMessage(null)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to load admin action logs."
      setErrorMessage(message)
    } finally {
      setIsLoading(false)
    }
  }, [actionType, outcome, page, queryText, targetType])

  useEffect(() => {
    void fetchLogs()
  }, [fetchLogs])

  const totalPages = logs?.pagination.totalPages ?? 0

  return (
    <Card className="border-border/70">
      <CardHeader>
        <CardTitle className="text-xl">Admin Action Logs</CardTitle>
        <p className="text-sm text-muted-foreground">
          Search and review recorded configuration and template actions.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2 lg:col-span-2">
            <Label htmlFor="admin-log-query">Search</Label>
            <Input
              id="admin-log-query"
              value={queryText}
              onChange={(event) => {
                setQueryText(event.target.value)
                setPage(1)
              }}
              placeholder="Search message, target ID, metadata"
              aria-label="Search admin logs"
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="admin-log-action">Action</Label>
            <select
              id="admin-log-action"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              value={actionType}
              onChange={(event) => {
                setActionType(event.target.value as "all" | AdminActionType)
                setPage(1)
              }}
              aria-label="Filter logs by action"
              disabled={isLoading}
            >
              {ACTION_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="admin-log-target">Target</Label>
            <select
              id="admin-log-target"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              value={targetType}
              onChange={(event) => {
                setTargetType(event.target.value as "all" | AdminActionTargetType)
                setPage(1)
              }}
              aria-label="Filter logs by target"
              disabled={isLoading}
            >
              {TARGET_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="admin-log-outcome">Outcome</Label>
            <select
              id="admin-log-outcome"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              value={outcome}
              onChange={(event) => {
                setOutcome(event.target.value as "all" | AdminActionOutcome)
                setPage(1)
              }}
              aria-label="Filter logs by outcome"
              disabled={isLoading}
            >
              {OUTCOME_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setQueryText("")
                setActionType("all")
                setTargetType("all")
                setOutcome("all")
                setPage(1)
              }}
              disabled={isLoading}
              aria-label="Clear log filters"
            >
              Clear Filters
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => void fetchLogs()}
              disabled={isLoading}
              aria-label="Refresh admin logs"
            >
              {isLoading ? "Loading..." : "Refresh"}
            </Button>
          </div>
        </div>

        {errorMessage ? (
          <p className="text-sm text-destructive" role="status" aria-live="polite">
            {errorMessage}
          </p>
        ) : null}

        {isLoading ? <p className="text-sm text-muted-foreground">Loading admin action logs...</p> : null}

        {!isLoading && !errorMessage && logs && logs.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No matching log entries found.</p>
        ) : null}

        {!isLoading && logs && logs.items.length > 0 ? (
          <div className="space-y-2">
            {logs.items.map((item) => (
              <div key={item._id} className="rounded-md border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">{item.message}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(item.createdAt, "PPp")}
                  </p>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {item.actorDisplayName} ({item.actorEmail}) • {item.actionType} • {item.outcome}
                </p>
                {item.targetId ? (
                  <p className="mt-1 text-xs text-muted-foreground">Target ID: {item.targetId}</p>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}

        {!isLoading && logs ? (
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Page {logs.pagination.page} of {Math.max(1, totalPages)} • {logs.pagination.totalCount} total
            </p>
            <p className="text-xs text-muted-foreground">
              Updated {format(logs.generatedAt, "PPp")}
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={page <= 1 || isLoading}
                aria-label="Previous logs page"
              >
                Previous
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPage((prev) => prev + 1)}
                disabled={totalPages > 0 ? page >= totalPages || isLoading : true}
                aria-label="Next logs page"
              >
                Next
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
