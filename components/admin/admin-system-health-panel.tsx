"use client"

import { useCallback, useEffect, useState } from "react"
import { formatDistanceToNow } from "date-fns"

import {
  AdminHealthStatus,
  ApiErrorResponse,
  ApiSuccessResponse,
} from "@/lib/admin-system-management-types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const HEALTH_REFRESH_MS = 30000

export function AdminSystemHealthPanel() {
  const [health, setHealth] = useState<AdminHealthStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const fetchHealth = useCallback(async (background: boolean) => {
    if (background) {
      setIsRefreshing(true)
    } else {
      setIsLoading(true)
    }

    try {
      const response = await fetch("/api/admin/health", {
        method: "GET",
        cache: "no-store",
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
        },
      })

      const body = (await response.json()) as
        | ApiSuccessResponse<AdminHealthStatus>
        | ApiErrorResponse

      if (!response.ok) {
        const message =
          body && "error" in body && body.error?.message
            ? body.error.message
            : "Unable to load system health."
        throw new Error(message)
      }

      if (!body || !("success" in body) || !body.success || !("data" in body)) {
        throw new Error("Unexpected system health response.")
      }

      setHealth(body.data)
      setErrorMessage(null)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to load system health."
      setErrorMessage(message)
    } finally {
      if (background) {
        setIsRefreshing(false)
      } else {
        setIsLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    void fetchHealth(false)
  }, [fetchHealth])

  useEffect(() => {
    const intervalId = setInterval(() => {
      void fetchHealth(true)
    }, HEALTH_REFRESH_MS)

    return () => {
      clearInterval(intervalId)
    }
  }, [fetchHealth])

  return (
    <Card className="border-border/70">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div>
          <CardTitle className="text-xl">System Health</CardTitle>
          <p className="text-sm text-muted-foreground">
            Real-time API and database probe visibility for admin operations.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void fetchHealth(true)}
          disabled={isRefreshing || isLoading}
          aria-label="Refresh system health"
        >
          {isRefreshing ? "Refreshing..." : "Refresh"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading system health...</p>
        ) : null}

        {errorMessage ? (
          <p className="text-sm text-destructive" role="status" aria-live="polite">
            {errorMessage}
          </p>
        ) : null}

        {!isLoading && !errorMessage && !health ? (
          <p className="text-sm text-muted-foreground">No health data available yet.</p>
        ) : null}

        {!isLoading && !errorMessage && health ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">Overall Status</p>
              <div className="mt-2">
                <Badge variant={health.status === "healthy" ? "secondary" : "destructive"}>
                  {health.status === "healthy" ? "Healthy" : "Degraded"}
                </Badge>
              </div>
            </div>

            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">API Latency</p>
              <p className="mt-1 text-2xl font-semibold">{health.apiLatencyMs} ms</p>
            </div>

            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">API Uptime</p>
              <p className="mt-1 text-2xl font-semibold">{health.apiUptimeSeconds}s</p>
            </div>

            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">Database</p>
              <div className="mt-2">
                <Badge variant={health.dbStatus === "up" ? "secondary" : "destructive"}>
                  {health.dbStatus === "up" ? "Up" : "Down"}
                </Badge>
              </div>
            </div>

            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">DB Latency</p>
              <p className="mt-1 text-2xl font-semibold">
                {health.dbLatencyMs === null ? "N/A" : `${health.dbLatencyMs} ms`}
              </p>
            </div>

            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">Checked</p>
              <p className="mt-1 text-sm font-medium">
                {formatDistanceToNow(health.checkedAt, { addSuffix: true })}
              </p>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
