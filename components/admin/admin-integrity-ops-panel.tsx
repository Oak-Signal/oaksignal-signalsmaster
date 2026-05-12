"use client"

import { useEffect, useMemo, useState } from "react"
import { useMutation, useQuery } from "convex/react"

import { api } from "@/convex/_generated/api"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface ReanalyzeSummary {
  scanned: number
  updated: number
  skippedMissingAttempt: number
  dryRun: boolean
}

const DEFAULT_REANALYZE_LIMIT = 50

function clampInteger(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min
  }

  return Math.min(Math.max(Math.round(value), min), max)
}

export function AdminIntegrityOpsPanel() {
  const thresholds = useQuery(api.exams.getExamIntegrityThresholds)
  const setExamIntegrityThresholds = useMutation(api.exams.setExamIntegrityThresholds)
  const reanalyzeOfficialResultIntegrity = useMutation(api.exams.reanalyzeOfficialResultIntegrity)

  const [minAverageAnswerTimeMs, setMinAverageAnswerTimeMs] = useState(5000)
  const [maxConsecutiveSameAnswer, setMaxConsecutiveSameAnswer] = useState(5)
  const [minExpectedDurationRatioPercent, setMinExpectedDurationRatioPercent] = useState(50)
  const [minAnswerTimeStdDevMs, setMinAnswerTimeStdDevMs] = useState(1000)

  const [isSavingThresholds, setIsSavingThresholds] = useState(false)
  const [settingsStatusMessage, setSettingsStatusMessage] = useState<string | null>(null)

  const [reanalyzeLimit, setReanalyzeLimit] = useState(DEFAULT_REANALYZE_LIMIT)
  const [isReanalyzing, setIsReanalyzing] = useState(false)
  const [reanalyzeStatusMessage, setReanalyzeStatusMessage] = useState<string | null>(null)
  const [lastReanalyzeSummary, setLastReanalyzeSummary] = useState<ReanalyzeSummary | null>(null)

  useEffect(() => {
    if (!thresholds) {
      return
    }

    setMinAverageAnswerTimeMs(thresholds.minAverageAnswerTimeMs)
    setMaxConsecutiveSameAnswer(thresholds.maxConsecutiveSameAnswer)
    setMinExpectedDurationRatioPercent(thresholds.minExpectedDurationRatioPercent)
    setMinAnswerTimeStdDevMs(thresholds.minAnswerTimeStdDevMs)
  }, [thresholds])

  const thresholdInputState = useMemo(
    () => ({
      minAverageAnswerTimeMs: clampInteger(minAverageAnswerTimeMs, 100, 120000),
      maxConsecutiveSameAnswer: clampInteger(maxConsecutiveSameAnswer, 2, 50),
      minExpectedDurationRatioPercent: clampInteger(minExpectedDurationRatioPercent, 1, 100),
      minAnswerTimeStdDevMs: clampInteger(minAnswerTimeStdDevMs, 100, 60000),
    }),
    [
      minAverageAnswerTimeMs,
      maxConsecutiveSameAnswer,
      minExpectedDurationRatioPercent,
      minAnswerTimeStdDevMs,
    ]
  )

  const handleSaveThresholds = async () => {
    setIsSavingThresholds(true)
    setSettingsStatusMessage(null)

    try {
      await setExamIntegrityThresholds(thresholdInputState)
      setSettingsStatusMessage("Integrity thresholds saved.")
    } catch {
      setSettingsStatusMessage("Failed to save integrity thresholds.")
    } finally {
      setIsSavingThresholds(false)
    }
  }

  const runReanalysis = async (dryRun: boolean) => {
    setIsReanalyzing(true)
    setReanalyzeStatusMessage(null)

    try {
      const summary = await reanalyzeOfficialResultIntegrity({
        limit: clampInteger(reanalyzeLimit, 1, 500),
        dryRun,
      })

      setLastReanalyzeSummary(summary)
      setReanalyzeStatusMessage(
        dryRun
          ? "Dry run complete. Review summary below."
          : "Reanalysis complete and changes applied."
      )
    } catch {
      setReanalyzeStatusMessage("Reanalysis failed.")
    } finally {
      setIsReanalyzing(false)
    }
  }

  return (
    <Card className="border-border/70">
      <CardHeader>
        <CardTitle className="text-xl">Integrity Operations</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <section className="space-y-3 rounded-md border bg-background p-4">
          <div>
            <h3 className="text-sm font-semibold">Detection Thresholds</h3>
            <p className="text-xs text-muted-foreground">
              Configure server-side suspicious-attempt detection thresholds.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label htmlFor="threshold-min-average">Min Average Answer Time (ms)</Label>
              <Input
                id="threshold-min-average"
                type="number"
                min={100}
                max={120000}
                value={minAverageAnswerTimeMs}
                onChange={(event) => setMinAverageAnswerTimeMs(Number(event.target.value))}
                disabled={isSavingThresholds}
              />
            </div>
            <div>
              <Label htmlFor="threshold-max-consecutive">Max Consecutive Same Answer</Label>
              <Input
                id="threshold-max-consecutive"
                type="number"
                min={2}
                max={50}
                value={maxConsecutiveSameAnswer}
                onChange={(event) => setMaxConsecutiveSameAnswer(Number(event.target.value))}
                disabled={isSavingThresholds}
              />
            </div>
            <div>
              <Label htmlFor="threshold-min-ratio">Min Expected Duration Ratio (%)</Label>
              <Input
                id="threshold-min-ratio"
                type="number"
                min={1}
                max={100}
                value={minExpectedDurationRatioPercent}
                onChange={(event) => setMinExpectedDurationRatioPercent(Number(event.target.value))}
                disabled={isSavingThresholds}
              />
            </div>
            <div>
              <Label htmlFor="threshold-min-stddev">Min Answer Time Std Dev (ms)</Label>
              <Input
                id="threshold-min-stddev"
                type="number"
                min={100}
                max={60000}
                value={minAnswerTimeStdDevMs}
                onChange={(event) => setMinAnswerTimeStdDevMs(Number(event.target.value))}
                disabled={isSavingThresholds}
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground" role="status" aria-live="polite">
              {settingsStatusMessage ?? "Thresholds are loaded from current exam settings."}
            </p>
            <Button
              type="button"
              onClick={() => void handleSaveThresholds()}
              disabled={isSavingThresholds || thresholds === undefined}
              aria-label="Save integrity thresholds"
            >
              {isSavingThresholds ? "Saving..." : "Save Thresholds"}
            </Button>
          </div>
        </section>

        <section className="space-y-3 rounded-md border bg-background p-4">
          <div>
            <h3 className="text-sm font-semibold">Retroactive Reanalysis</h3>
            <p className="text-xs text-muted-foreground">
              Recompute integrity scores for historical results using current thresholds.
            </p>
          </div>

          <div className="max-w-xs">
            <Label htmlFor="reanalyze-limit">Results Limit</Label>
            <Input
              id="reanalyze-limit"
              type="number"
              min={1}
              max={500}
              value={reanalyzeLimit}
              onChange={(event) => setReanalyzeLimit(Number(event.target.value))}
              disabled={isReanalyzing}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => void runReanalysis(true)}
              disabled={isReanalyzing}
              aria-label="Run integrity reanalysis dry run"
            >
              {isReanalyzing ? "Running..." : "Dry Run"}
            </Button>
            <Button
              type="button"
              onClick={() => void runReanalysis(false)}
              disabled={isReanalyzing}
              aria-label="Apply integrity reanalysis"
            >
              {isReanalyzing ? "Running..." : "Apply Reanalysis"}
            </Button>
          </div>

          {lastReanalyzeSummary ? (
            <div className="rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground">
              <p>
                Summary: scanned {lastReanalyzeSummary.scanned}, updated {lastReanalyzeSummary.updated}, skipped {lastReanalyzeSummary.skippedMissingAttempt}.
              </p>
              <p>Mode: {lastReanalyzeSummary.dryRun ? "dry-run" : "apply"}.</p>
            </div>
          ) : null}

          <p className="text-xs text-muted-foreground" role="status" aria-live="polite">
            {reanalyzeStatusMessage ?? "Run a dry-run first before applying updates."}
          </p>
        </section>
      </CardContent>
    </Card>
  )
}
