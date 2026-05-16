"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { format } from "date-fns"

import {
  AdminSystemConfig,
  ApiErrorResponse,
  ApiSuccessResponse,
} from "@/lib/admin-system-management-types"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface AdminSystemConfigDraft {
  examEnabled: boolean
  questionCount: number
  passThreshold: number
  startDate: string
  endDate: string
  startTime: string
  endTime: string
  timeZone: string
  maxRetakes: number
  retakeCooldownHours: number
  maintenanceModeEnabled: boolean
  maintenanceMessage: string
}

function toDraft(config: AdminSystemConfig): AdminSystemConfigDraft {
  return {
    examEnabled: config.examEnabled,
    questionCount: config.questionCount,
    passThreshold: config.passThreshold,
    startDate: config.availabilityWindow.startDate,
    endDate: config.availabilityWindow.endDate,
    startTime: config.availabilityWindow.startTime,
    endTime: config.availabilityWindow.endTime,
    timeZone: config.availabilityWindow.timeZone ?? "UTC",
    maxRetakes: config.maxRetakes,
    retakeCooldownHours: config.retakeCooldownHours,
    maintenanceModeEnabled: config.maintenanceModeEnabled,
    maintenanceMessage: config.maintenanceMessage ?? "",
  }
}

function nowIsoDate(): string {
  return format(Date.now(), "yyyy-MM-dd")
}

function buildDefaultDraft(): AdminSystemConfigDraft {
  return {
    examEnabled: true,
    questionCount: 50,
    passThreshold: 80,
    startDate: nowIsoDate(),
    endDate: nowIsoDate(),
    startTime: "08:00",
    endTime: "20:00",
    timeZone: "UTC",
    maxRetakes: 3,
    retakeCooldownHours: 24,
    maintenanceModeEnabled: false,
    maintenanceMessage: "",
  }
}

export function AdminSystemConfigPanel() {
  const [config, setConfig] = useState<AdminSystemConfig | null>(null)
  const [draft, setDraft] = useState<AdminSystemConfigDraft>(buildDefaultDraft)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  const fetchConfig = useCallback(async () => {
    setIsLoading(true)

    try {
      const response = await fetch("/api/admin/config", {
        method: "GET",
        cache: "no-store",
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
        },
      })

      const body = (await response.json()) as
        | ApiSuccessResponse<AdminSystemConfig>
        | ApiErrorResponse

      if (!response.ok) {
        const message =
          body && "error" in body && body.error?.message
            ? body.error.message
            : "Unable to load system configuration."
        throw new Error(message)
      }

      if (!body || !("success" in body) || !body.success || !("data" in body)) {
        throw new Error("Unexpected configuration response.")
      }

      setConfig(body.data)
      setDraft(toDraft(body.data))
      setErrorMessage(null)
      setStatusMessage(null)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to load system configuration."
      setErrorMessage(message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchConfig()
  }, [fetchConfig])

  const hasPendingChanges = useMemo(() => {
    if (!config) {
      return false
    }

    const configDraft = toDraft(config)
    return JSON.stringify(configDraft) !== JSON.stringify(draft)
  }, [config, draft])

  const handleSave = async () => {
    setIsSaving(true)
    setStatusMessage(null)

    try {
      const response = await fetch("/api/admin/config", {
        method: "PUT",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          examEnabled: draft.examEnabled,
          questionCount: draft.questionCount,
          passThreshold: draft.passThreshold,
          availabilityWindow: {
            startDate: draft.startDate,
            endDate: draft.endDate,
            startTime: draft.startTime,
            endTime: draft.endTime,
            timeZone: draft.timeZone.trim() || undefined,
          },
          maxRetakes: draft.maxRetakes,
          retakeCooldownHours: draft.retakeCooldownHours,
          maintenanceModeEnabled: draft.maintenanceModeEnabled,
          maintenanceMessage: draft.maintenanceMessage.trim() || undefined,
        }),
      })

      const body = (await response.json()) as
        | ApiSuccessResponse<AdminSystemConfig>
        | ApiErrorResponse

      if (!response.ok) {
        const message =
          body && "error" in body && body.error?.message
            ? body.error.message
            : "Unable to save system configuration."
        throw new Error(message)
      }

      if (!body || !("success" in body) || !body.success || !("data" in body)) {
        throw new Error("Unexpected configuration save response.")
      }

      setConfig(body.data)
      setDraft(toDraft(body.data))
      setErrorMessage(null)
      setStatusMessage("System configuration saved.")
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to save system configuration."
      setErrorMessage(message)
      setStatusMessage(null)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Card className="border-border/70">
      <CardHeader>
        <CardTitle className="text-xl">Exam Configuration</CardTitle>
        <p className="text-sm text-muted-foreground">
          Manage global exam availability, thresholds, schedule, retake rules, and maintenance mode.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        {isLoading ? <p className="text-sm text-muted-foreground">Loading configuration...</p> : null}

        {errorMessage ? (
          <p className="text-sm text-destructive" role="status" aria-live="polite">
            {errorMessage}
          </p>
        ) : null}

        {!isLoading ? (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="config-question-count">Question Count</Label>
                <Input
                  id="config-question-count"
                  type="number"
                  min={4}
                  max={200}
                  value={draft.questionCount}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      questionCount: Number(event.target.value),
                    }))
                  }
                  disabled={isSaving}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="config-pass-threshold">Pass Threshold (%)</Label>
                <Input
                  id="config-pass-threshold"
                  type="number"
                  min={1}
                  max={100}
                  value={draft.passThreshold}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      passThreshold: Number(event.target.value),
                    }))
                  }
                  disabled={isSaving}
                />
              </div>
            </div>

            <div className="rounded-md border p-3">
              <p className="text-sm font-semibold">Availability Window</p>
              <div className="mt-3 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="config-start-date">Start Date</Label>
                  <Input
                    id="config-start-date"
                    type="date"
                    value={draft.startDate}
                    onChange={(event) =>
                      setDraft((prev) => ({
                        ...prev,
                        startDate: event.target.value,
                      }))
                    }
                    disabled={isSaving}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="config-end-date">End Date</Label>
                  <Input
                    id="config-end-date"
                    type="date"
                    value={draft.endDate}
                    onChange={(event) =>
                      setDraft((prev) => ({
                        ...prev,
                        endDate: event.target.value,
                      }))
                    }
                    disabled={isSaving}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="config-timezone">Time Zone</Label>
                  <Input
                    id="config-timezone"
                    value={draft.timeZone}
                    onChange={(event) =>
                      setDraft((prev) => ({
                        ...prev,
                        timeZone: event.target.value,
                      }))
                    }
                    placeholder="UTC"
                    disabled={isSaving}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="config-start-time">Start Time</Label>
                  <Input
                    id="config-start-time"
                    type="time"
                    value={draft.startTime}
                    onChange={(event) =>
                      setDraft((prev) => ({
                        ...prev,
                        startTime: event.target.value,
                      }))
                    }
                    disabled={isSaving}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="config-end-time">End Time</Label>
                  <Input
                    id="config-end-time"
                    type="time"
                    value={draft.endTime}
                    onChange={(event) =>
                      setDraft((prev) => ({
                        ...prev,
                        endTime: event.target.value,
                      }))
                    }
                    disabled={isSaving}
                  />
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="config-max-retakes">Max Retakes</Label>
                <Input
                  id="config-max-retakes"
                  type="number"
                  min={0}
                  max={20}
                  value={draft.maxRetakes}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      maxRetakes: Number(event.target.value),
                    }))
                  }
                  disabled={isSaving}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="config-retake-cooldown">Retake Cooldown (hours)</Label>
                <Input
                  id="config-retake-cooldown"
                  type="number"
                  min={0}
                  max={720}
                  value={draft.retakeCooldownHours}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      retakeCooldownHours: Number(event.target.value),
                    }))
                  }
                  disabled={isSaving}
                />
              </div>
            </div>

            <div className="rounded-md border p-3 space-y-3">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="config-exam-enabled"
                  checked={draft.examEnabled}
                  onCheckedChange={(checked) =>
                    setDraft((prev) => ({
                      ...prev,
                      examEnabled: checked === true,
                    }))
                  }
                  disabled={isSaving}
                  aria-label="Enable official exam globally"
                />
                <div>
                  <Label htmlFor="config-exam-enabled">Enable Exam Globally</Label>
                  <p className="text-xs text-muted-foreground">
                    Disable to block all new exam starts.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Checkbox
                  id="config-maintenance-mode"
                  checked={draft.maintenanceModeEnabled}
                  onCheckedChange={(checked) =>
                    setDraft((prev) => ({
                      ...prev,
                      maintenanceModeEnabled: checked === true,
                    }))
                  }
                  disabled={isSaving}
                  aria-label="Enable maintenance mode"
                />
                <div className="w-full">
                  <Label htmlFor="config-maintenance-mode">Maintenance Mode</Label>
                  <p className="text-xs text-muted-foreground">
                    Show maintenance message and prevent new starts.
                  </p>
                  <textarea
                    id="config-maintenance-message"
                    className="mt-2 flex min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm"
                    value={draft.maintenanceMessage}
                    onChange={(event) =>
                      setDraft((prev) => ({
                        ...prev,
                        maintenanceMessage: event.target.value,
                      }))
                    }
                    disabled={isSaving}
                    maxLength={500}
                    placeholder="System maintenance in progress. Please try again later."
                    aria-label="Maintenance mode message"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground" role="status" aria-live="polite">
                {statusMessage ??
                  (hasPendingChanges
                    ? "Unsaved changes present."
                    : "No pending configuration changes.")}
              </p>
              <Button
                type="button"
                onClick={() => void handleSave()}
                disabled={isSaving || !hasPendingChanges}
                aria-label="Save exam configuration"
              >
                {isSaving ? "Saving..." : "Save Configuration"}
              </Button>
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  )
}
