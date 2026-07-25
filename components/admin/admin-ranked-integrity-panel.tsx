"use client"

import { useState } from "react"
import { format } from "date-fns"
import { AlertTriangle, ShieldAlert } from "lucide-react"
import { useMutation, useQuery } from "convex/react"

import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"

type ReviewStatus = "none" | "pending" | "confirmed" | "dismissed"
type AntiCheatStatus = "clear" | "flagged" | "reviewing" | "disqualified"

function formatDateTime(value: number | null): string {
  if (value === null) {
    return "N/A"
  }

  return format(value, "PPp")
}

function formatDuration(durationMs: number | null): string {
  if (durationMs === null || !Number.isFinite(durationMs) || durationMs < 0) {
    return "N/A"
  }

  const totalSeconds = Math.floor(durationMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  if (minutes === 0) {
    return `${seconds}s`
  }

  return `${minutes}m ${seconds}s`
}

function formatAccuracyPercent(accuracyPercent: number): string {
  return `${accuracyPercent.toFixed(0)}%`
}

function getAntiCheatStatusBadgeClass(status: AntiCheatStatus): string {
  if (status === "disqualified") {
    return "border-red-200 bg-red-100 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200"
  }

  if (status === "reviewing") {
    return "border-blue-200 bg-blue-100 text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200"
  }

  if (status === "flagged") {
    return "border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"
  }

  return "border-slate-200 bg-slate-100 text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
}

function getReviewStatusBadgeClass(status: ReviewStatus): string {
  if (status === "confirmed") {
    return "border-red-200 bg-red-100 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200"
  }

  if (status === "dismissed") {
    return "border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
  }

  if (status === "pending") {
    return "border-blue-200 bg-blue-100 text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200"
  }

  return "border-slate-200 bg-slate-100 text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
}

function getReviewStatusLabel(status: ReviewStatus): string {
  if (status === "confirmed") {
    return "Invalidated"
  }

  if (status === "dismissed") {
    return "Cleared"
  }

  if (status === "pending") {
    return "In Review"
  }

  return "Awaiting Review"
}

function getSeverityBadgeClass(severity: "low" | "medium" | "high" | null): string {
  if (severity === "high") {
    return "border-red-200 bg-red-100 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200"
  }

  if (severity === "medium") {
    return "border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"
  }

  return "border-slate-200 bg-slate-100 text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
}

function LoadingRows() {
  return (
    <>
      {Array.from({ length: 4 }).map((_, index) => (
        <tr key={`loading-row-${index}`} className="border-b last:border-b-0">
          <td className="px-4 py-3"><Skeleton className="h-4 w-32" /></td>
          <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
          <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
          <td className="px-4 py-3"><Skeleton className="h-6 w-24 rounded-full" /></td>
          <td className="px-4 py-3"><Skeleton className="h-6 w-24 rounded-full" /></td>
          <td className="px-4 py-3"><Skeleton className="h-4 w-32" /></td>
          <td className="px-4 py-3"><Skeleton className="h-8 w-40" /></td>
        </tr>
      ))}
    </>
  )
}

export function AdminRankedIntegrityPanel() {
  const queue = useQuery(api.ranked.getRankedIntegrityQueue, {})
  const reviewRankedRun = useMutation(api.ranked.reviewRankedRun)
  const { toast } = useToast()

  const [pendingRunId, setPendingRunId] = useState<Id<"rankedRuns"> | null>(null)
  const [invalidateDialogRunId, setInvalidateDialogRunId] = useState<Id<"rankedRuns"> | null>(null)
  const [invalidateNote, setInvalidateNote] = useState("")

  const isLoading = queue === undefined
  const items = queue?.items ?? []
  const hasItems = items.length > 0

  const applyReviewStatus = async (
    runId: Id<"rankedRuns">,
    reviewStatus: "pending" | "confirmed" | "dismissed",
    note?: string
  ) => {
    setPendingRunId(runId)

    try {
      await reviewRankedRun({ runId, reviewStatus, note })
      toast({
        title:
          reviewStatus === "confirmed"
            ? "Run invalidated"
            : reviewStatus === "dismissed"
              ? "Run cleared"
              : "Run marked in review",
        description:
          reviewStatus === "confirmed"
            ? "This run is now excluded from the leaderboard."
            : "The review status has been updated.",
      })
    } catch (error) {
      toast({
        title: "Review action failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      })
    } finally {
      setPendingRunId(null)
    }
  }

  const handleConfirmInvalidate = async () => {
    if (!invalidateDialogRunId) {
      return
    }

    await applyReviewStatus(invalidateDialogRunId, "confirmed", invalidateNote)
    setInvalidateDialogRunId(null)
    setInvalidateNote("")
  }

  return (
    <Card className="border-border/70">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <ShieldAlert className="h-5 w-5 text-amber-600" aria-hidden="true" />
          Flagged Ranked Sessions
        </CardTitle>
        <CardDescription>
          Triage ranked runs flagged by the anti-cheat system and progress them through the
          review workflow.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="overflow-x-auto rounded-md border" aria-busy={isLoading}>
          <table className="w-full min-w-240 text-sm" aria-label="Flagged ranked sessions">
            <thead className="bg-muted/50">
              <tr>
                <th scope="col" className="px-4 py-3 text-left font-medium">Cadet</th>
                <th scope="col" className="px-4 py-3 text-left font-medium">Season</th>
                <th scope="col" className="px-4 py-3 text-left font-medium">Score</th>
                <th scope="col" className="px-4 py-3 text-left font-medium">Flags</th>
                <th scope="col" className="px-4 py-3 text-left font-medium">Review Status</th>
                <th scope="col" className="px-4 py-3 text-left font-medium">Completed</th>
                <th scope="col" className="px-4 py-3 text-left font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <LoadingRows />
              ) : hasItems ? (
                items.map((item) => {
                  const isRowPending = pendingRunId === item.runId
                  const isTerminal = item.reviewStatus === "confirmed" || item.reviewStatus === "dismissed"

                  return (
                    <tr key={item.runId} className="border-b align-top transition-colors hover:bg-muted/30 last:border-b-0">
                      <td className="px-4 py-3 font-medium">
                        <div>{item.userName}</div>
                        {item.userEmail ? (
                          <div className="text-xs text-muted-foreground">{item.userEmail}</div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{item.seasonName}</td>
                      <td className="px-4 py-3">
                        <div>{item.score}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatAccuracyPercent(item.accuracyPercent)} · {formatDuration(item.runDurationMs)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge className={getAntiCheatStatusBadgeClass(item.antiCheatStatus)}>
                              {item.antiCheatStatus.toUpperCase()}
                            </Badge>
                            {item.suspiciousSeverity ? (
                              <Badge className={getSeverityBadgeClass(item.suspiciousSeverity)}>
                                {item.suspiciousSeverity.toUpperCase()}
                              </Badge>
                            ) : null}
                          </div>
                          {item.suspiciousFlags.length > 0 ? (
                            <ul className="list-inside list-disc text-xs text-muted-foreground">
                              {item.suspiciousFlags.map((flag) => (
                                <li key={flag}>{flag}</li>
                              ))}
                            </ul>
                          ) : null}
                          {item.timingAnomalies.length > 0 ? (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <AlertTriangle className="h-3.5 w-3.5 text-amber-600" aria-hidden="true" />
                              {item.timingAnomalies.length} timing anomal{item.timingAnomalies.length === 1 ? "y" : "ies"}
                            </div>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={getReviewStatusBadgeClass(item.reviewStatus)}>
                          {getReviewStatusLabel(item.reviewStatus)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDateTime(item.completedAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={isRowPending || isTerminal || item.reviewStatus === "pending"}
                            onClick={() => void applyReviewStatus(item.runId, "pending")}
                            aria-label={`Mark ${item.userName}'s run as in review`}
                          >
                            Mark In Review
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={isRowPending || isTerminal}
                            onClick={() => void applyReviewStatus(item.runId, "dismissed")}
                            aria-label={`Dismiss ${item.userName}'s run as a false positive`}
                          >
                            Dismiss
                          </Button>
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            disabled={isRowPending || isTerminal}
                            onClick={() => {
                              setInvalidateNote("")
                              setInvalidateDialogRunId(item.runId)
                            }}
                            aria-label={`Invalidate ${item.userName}'s run`}
                          >
                            Invalidate
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No flagged ranked sessions to review.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>

      <Dialog
        open={invalidateDialogRunId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setInvalidateDialogRunId(null)
            setInvalidateNote("")
          }
        }}
      >
        <DialogContent aria-describedby="invalidate-ranked-run-description">
          <DialogHeader>
            <DialogTitle>Invalidate Ranked Run</DialogTitle>
            <DialogDescription id="invalidate-ranked-run-description">
              This excludes the run from the leaderboard. The run&apos;s score is never modified —
              only its review status changes. This action can be reviewed again later if needed.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="invalidate-ranked-run-note">Note (optional)</Label>
            <textarea
              id="invalidate-ranked-run-note"
              value={invalidateNote}
              onChange={(event) => setInvalidateNote(event.target.value)}
              className="min-h-24 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm"
              placeholder="Add context for this invalidation..."
              maxLength={300}
              disabled={pendingRunId !== null}
              aria-label="Invalidation note"
            />
            <p className="text-xs text-muted-foreground">{invalidateNote.length}/300</p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setInvalidateDialogRunId(null)
                setInvalidateNote("")
              }}
              disabled={pendingRunId !== null}
              aria-label="Cancel ranked run invalidation"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void handleConfirmInvalidate()}
              disabled={pendingRunId !== null}
              aria-label="Confirm ranked run invalidation"
            >
              Invalidate Run
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
