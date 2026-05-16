"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

import {
  AdminExamTemplate,
  ApiErrorResponse,
  ApiSuccessResponse,
} from "@/lib/admin-system-management-types"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface TemplateDraft {
  name: string
  description: string
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
}

function buildDefaultDraft(): TemplateDraft {
  return {
    name: "",
    description: "",
    examEnabled: true,
    questionCount: 50,
    passThreshold: 80,
    startDate: "2025-01-01",
    endDate: "2025-12-31",
    startTime: "08:00",
    endTime: "20:00",
    timeZone: "UTC",
    maxRetakes: 3,
    retakeCooldownHours: 24,
  }
}

interface TemplatesResponse {
  success: true
  data: AdminExamTemplate[]
}

interface TemplateMutationResponse {
  success: true
  data: AdminExamTemplate
}

export function AdminExamTemplatesPanel() {
  const [templates, setTemplates] = useState<AdminExamTemplate[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [includeArchived, setIncludeArchived] = useState(false)
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null)
  const [draft, setDraft] = useState<TemplateDraft>(buildDefaultDraft)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  const isEditing = editingTemplateId !== null

  const fetchTemplates = useCallback(async (nextIncludeArchived: boolean) => {
    setIsLoading(true)

    try {
      const params = new URLSearchParams({
        includeArchived: String(nextIncludeArchived),
      })

      const response = await fetch(`/api/admin/config/templates?${params.toString()}`, {
        method: "GET",
        cache: "no-store",
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
        },
      })

      const body = (await response.json()) as TemplatesResponse | ApiErrorResponse
      if (!response.ok) {
        const message =
          body && "error" in body && body.error?.message
            ? body.error.message
            : "Unable to load templates."
        throw new Error(message)
      }

      if (!body || !("success" in body) || !body.success || !("data" in body)) {
        throw new Error("Unexpected templates response.")
      }

      setTemplates(body.data)
      setErrorMessage(null)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load templates."
      setErrorMessage(message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchTemplates(includeArchived)
  }, [fetchTemplates, includeArchived])

  const canSubmit = useMemo(() => {
    return draft.name.trim().length >= 2 && !isSaving
  }, [draft.name, isSaving])

  const resetDraft = () => {
    setDraft(buildDefaultDraft())
    setEditingTemplateId(null)
  }

  const hydrateDraftFromTemplate = (template: AdminExamTemplate) => {
    setDraft({
      name: template.name,
      description: template.description ?? "",
      examEnabled: template.settings.examEnabled,
      questionCount: template.settings.questionCount,
      passThreshold: template.settings.passThreshold,
      startDate: template.settings.availabilityWindow.startDate,
      endDate: template.settings.availabilityWindow.endDate,
      startTime: template.settings.availabilityWindow.startTime,
      endTime: template.settings.availabilityWindow.endTime,
      timeZone: template.settings.availabilityWindow.timeZone ?? "UTC",
      maxRetakes: template.settings.maxRetakes,
      retakeCooldownHours: template.settings.retakeCooldownHours,
    })
  }

  const handleSubmit = async () => {
    setIsSaving(true)
    setStatusMessage(null)

    try {
      const payload = {
        name: draft.name.trim(),
        description: draft.description.trim() || undefined,
        settings: {
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
        },
      }

      const method = isEditing ? "PUT" : "POST"
      const endpoint = isEditing
        ? `/api/admin/config/templates/${editingTemplateId}`
        : "/api/admin/config/templates"

      const response = await fetch(endpoint, {
        method,
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      })

      const body = (await response.json()) as TemplateMutationResponse | ApiErrorResponse
      if (!response.ok) {
        const message =
          body && "error" in body && body.error?.message
            ? body.error.message
            : "Unable to save template."
        throw new Error(message)
      }

      if (!body || !("success" in body) || !body.success || !("data" in body)) {
        throw new Error("Unexpected template save response.")
      }

      setStatusMessage(isEditing ? "Template updated." : "Template created.")
      setErrorMessage(null)
      resetDraft()
      await fetchTemplates(includeArchived)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to save template."
      setErrorMessage(message)
      setStatusMessage(null)
    } finally {
      setIsSaving(false)
    }
  }

  const handleArchive = async (templateId: string) => {
    setIsSaving(true)
    setStatusMessage(null)

    try {
      const response = await fetch(`/api/admin/config/templates/${templateId}`, {
        method: "DELETE",
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
        },
      })

      const body = (await response.json()) as TemplateMutationResponse | ApiErrorResponse
      if (!response.ok) {
        const message =
          body && "error" in body && body.error?.message
            ? body.error.message
            : "Unable to archive template."
        throw new Error(message)
      }

      setStatusMessage("Template archived.")
      setErrorMessage(null)
      if (editingTemplateId === templateId) {
        resetDraft()
      }
      await fetchTemplates(includeArchived)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to archive template."
      setErrorMessage(message)
      setStatusMessage(null)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Card className="border-border/70">
      <CardHeader>
        <CardTitle className="text-xl">Exam Templates</CardTitle>
        <p className="text-sm text-muted-foreground">
          Create reusable template presets for exam settings and lifecycle controls.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-md border p-4 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="template-name">Template Name</Label>
              <Input
                id="template-name"
                value={draft.name}
                onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))}
                maxLength={80}
                disabled={isSaving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="template-description">Description</Label>
              <Input
                id="template-description"
                value={draft.description}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, description: event.target.value }))
                }
                maxLength={300}
                disabled={isSaving}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="template-question-count">Question Count</Label>
              <Input
                id="template-question-count"
                type="number"
                min={4}
                max={200}
                value={draft.questionCount}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, questionCount: Number(event.target.value) }))
                }
                disabled={isSaving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="template-pass-threshold">Pass Threshold (%)</Label>
              <Input
                id="template-pass-threshold"
                type="number"
                min={1}
                max={100}
                value={draft.passThreshold}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, passThreshold: Number(event.target.value) }))
                }
                disabled={isSaving}
              />
            </div>
            <div className="flex items-center gap-2 pt-7">
              <Checkbox
                id="template-exam-enabled"
                checked={draft.examEnabled}
                onCheckedChange={(checked) =>
                  setDraft((prev) => ({ ...prev, examEnabled: checked === true }))
                }
                disabled={isSaving}
                aria-label="Enable exam for this template"
              />
              <Label htmlFor="template-exam-enabled">Exam Enabled</Label>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="template-start-date">Start Date</Label>
              <Input
                id="template-start-date"
                type="date"
                value={draft.startDate}
                onChange={(event) => setDraft((prev) => ({ ...prev, startDate: event.target.value }))}
                disabled={isSaving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="template-end-date">End Date</Label>
              <Input
                id="template-end-date"
                type="date"
                value={draft.endDate}
                onChange={(event) => setDraft((prev) => ({ ...prev, endDate: event.target.value }))}
                disabled={isSaving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="template-timezone">Time Zone</Label>
              <Input
                id="template-timezone"
                value={draft.timeZone}
                onChange={(event) => setDraft((prev) => ({ ...prev, timeZone: event.target.value }))}
                disabled={isSaving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="template-start-time">Start Time</Label>
              <Input
                id="template-start-time"
                type="time"
                value={draft.startTime}
                onChange={(event) => setDraft((prev) => ({ ...prev, startTime: event.target.value }))}
                disabled={isSaving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="template-end-time">End Time</Label>
              <Input
                id="template-end-time"
                type="time"
                value={draft.endTime}
                onChange={(event) => setDraft((prev) => ({ ...prev, endTime: event.target.value }))}
                disabled={isSaving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="template-max-retakes">Max Retakes</Label>
              <Input
                id="template-max-retakes"
                type="number"
                min={0}
                max={20}
                value={draft.maxRetakes}
                onChange={(event) => setDraft((prev) => ({ ...prev, maxRetakes: Number(event.target.value) }))}
                disabled={isSaving}
              />
            </div>
          </div>

          <div className="max-w-xs space-y-2">
            <Label htmlFor="template-retake-cooldown">Retake Cooldown (hours)</Label>
            <Input
              id="template-retake-cooldown"
              type="number"
              min={0}
              max={720}
              value={draft.retakeCooldownHours}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, retakeCooldownHours: Number(event.target.value) }))
              }
              disabled={isSaving}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground" role="status" aria-live="polite">
              {statusMessage ??
                (isEditing
                  ? "Editing selected template."
                  : "Create a new reusable template preset.")}
            </p>
            <div className="flex items-center gap-2">
              {isEditing ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={resetDraft}
                  disabled={isSaving}
                  aria-label="Cancel template edit"
                >
                  Cancel Edit
                </Button>
              ) : null}
              <Button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={!canSubmit}
                aria-label={isEditing ? "Update template" : "Create template"}
              >
                {isSaving ? "Saving..." : isEditing ? "Update Template" : "Create Template"}
              </Button>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Checkbox
              id="templates-include-archived"
              checked={includeArchived}
              onCheckedChange={(checked) => setIncludeArchived(checked === true)}
              disabled={isLoading || isSaving}
              aria-label="Include archived templates"
            />
            <Label htmlFor="templates-include-archived">Include archived templates</Label>
          </div>
        </div>

        {errorMessage ? (
          <p className="text-sm text-destructive" role="status" aria-live="polite">
            {errorMessage}
          </p>
        ) : null}

        {isLoading ? <p className="text-sm text-muted-foreground">Loading templates...</p> : null}

        {!isLoading && templates.length === 0 ? (
          <p className="text-sm text-muted-foreground">No templates found for current filter.</p>
        ) : null}

        {!isLoading && templates.length > 0 ? (
          <div className="space-y-2">
            {templates.map((template) => (
              <div key={template._id} className="rounded-md border p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{template.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {template.description?.trim() || "No description"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {template.settings.questionCount} questions • pass {template.settings.passThreshold}% • retakes {template.settings.maxRetakes}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingTemplateId(template._id)
                        hydrateDraftFromTemplate(template)
                      }}
                      disabled={isSaving}
                      aria-label={`Edit template ${template.name}`}
                    >
                      Edit
                    </Button>
                    {template.archivedAt === undefined ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void handleArchive(template._id)}
                        disabled={isSaving}
                        aria-label={`Archive template ${template.name}`}
                      >
                        Archive
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
