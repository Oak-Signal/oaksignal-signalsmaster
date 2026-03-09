"use client"

import { useCallback, useEffect, useState } from "react"

import { AdminStatsOverview, type AdminExamOverviewStats } from "@/components/admin/admin-stats-overview"

const STATS_REFRESH_INTERVAL_MS = 30_000

interface AdminStatsResponse {
  success: true
  data: AdminExamOverviewStats
}

interface AdminStatsErrorResponse {
  success: false
  error?: {
    message?: string
  }
}

export function AdminStatsOverviewSection() {
  const [stats, setStats] = useState<AdminExamOverviewStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const fetchStats = useCallback(async (isBackgroundRefresh: boolean) => {
    if (!isBackgroundRefresh) {
      setIsLoading(true)
    }

    try {
      const response = await fetch("/api/admin/stats", {
        method: "GET",
        cache: "no-store",
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
        },
      })

      const body = (await response.json()) as AdminStatsResponse | AdminStatsErrorResponse

      if (!response.ok) {
        const message =
          body && "error" in body && body.error?.message
            ? body.error.message
            : "Unable to load admin statistics."
        throw new Error(message)
      }

      if (!body || !("success" in body) || !body.success || !("data" in body)) {
        throw new Error("Unexpected admin statistics response.")
      }

      setStats(body.data)
      setErrorMessage(null)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load admin statistics."
      setErrorMessage(message)
    } finally {
      if (!isBackgroundRefresh) {
        setIsLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    void fetchStats(false)

    const intervalId = setInterval(() => {
      void fetchStats(true)
    }, STATS_REFRESH_INTERVAL_MS)

    return () => {
      clearInterval(intervalId)
    }
  }, [fetchStats])

  return (
    <div className="space-y-2">
      {errorMessage ? (
        <p className="text-sm text-destructive">
          {errorMessage}
        </p>
      ) : null}
      <AdminStatsOverview stats={stats} isLoading={isLoading} />
    </div>
  )
}
