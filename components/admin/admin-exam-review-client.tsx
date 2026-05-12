"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { useMutation } from "convex/react";
import { AlertTriangle, ShieldCheck } from "lucide-react";

import { Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import { OfficialExamResult } from "@/lib/exam-types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

interface AdminExamReviewClientProps {
  examResultId: Id<"examResults">;
}

function formatDateTime(value: number): string {
  return format(value, "PPp");
}

function formatDuration(durationMs: number): string {
  if (!Number.isFinite(durationMs) || durationMs < 0) {
    return "N/A";
  }

  const totalSeconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes === 0) {
    return `${seconds}s`;
  }

  return `${minutes}m ${seconds}s`;
}

function formatScorePercent(scorePercent: number): string {
  return `${scorePercent.toFixed(2)}%`;
}

function formatResponseTime(value: number | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return "Not tracked";
  }

  if (value < 1000) {
    return `${value} ms`;
  }

  const seconds = value / 1000;
  if (seconds < 60) {
    return `${seconds.toFixed(1)} sec`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return `${minutes}m ${remainingSeconds}s`;
}

function getOptionLabel(
  options: Array<{ id: string; label: string; value: string }>,
  optionId: string | null
): string {
  if (!optionId) {
    return "No answer submitted";
  }

  const option = options.find((item) => item.id === optionId);
  if (!option) {
    return optionId;
  }

  return option.label?.trim() ? option.label : option.value;
}

export function AdminExamReviewClient({ examResultId }: AdminExamReviewClientProps) {
  const getOfficialResultForAdminReview = useMutation(api.exams.getOfficialResultForAdminReview);
  const setOfficialResultInvestigationNotes = useMutation(
    api.exams.setOfficialResultInvestigationNotes
  );
  const [result, setResult] = useState<OfficialExamResult | null | undefined>(undefined);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState<string>("");
  const [notesStatusMessage, setNotesStatusMessage] = useState<string | null>(null);
  const [isSavingNotes, setIsSavingNotes] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void getOfficialResultForAdminReview({ examResultId })
      .then((data) => {
        if (cancelled) {
          return;
        }

        const nextResult = (data as OfficialExamResult | null) ?? null;
        setResult(nextResult);
        setNotesDraft(nextResult?.investigationNotes?.notes ?? "");
        setNotesStatusMessage(null);
        setErrorMessage(null);
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        setResult(null);
        setErrorMessage("Failed to load official exam result.");
      });

    return () => {
      cancelled = true;
    };
  }, [examResultId, getOfficialResultForAdminReview]);

  const handleSaveInvestigationNotes = async () => {
    if (!result || isSavingNotes) {
      return;
    }

    setIsSavingNotes(true);
    setNotesStatusMessage(null);

    try {
      const updated = await setOfficialResultInvestigationNotes({
        examResultId,
        notes: notesDraft,
      });

      if (!updated) {
        setNotesStatusMessage("Unable to save notes. Administrator access is required.");
        return;
      }

      const nextResult = updated as OfficialExamResult;
      setResult(nextResult);
      setNotesDraft(nextResult.investigationNotes?.notes ?? "");
      setNotesStatusMessage("Investigation notes saved.");
    } catch {
      setNotesStatusMessage("Failed to save investigation notes.");
    } finally {
      setIsSavingNotes(false);
    }
  };

  const integritySeverityClass =
    result?.integritySeverity === "high"
      ? "border-red-200 bg-red-100 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200"
      : result?.integritySeverity === "medium"
        ? "border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"
        : "border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200";

  if (result === undefined) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Loading exam review...</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Retrieving immutable exam result details.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Unable to Load Exam Review</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-destructive">{errorMessage}</p>
            <Button asChild variant="outline">
              <Link href="/admin/exams">Back to Exam Management</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Result Not Found</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This exam result does not exist or you do not have access to review it.
            </p>
            <Button asChild variant="outline">
              <Link href="/admin/exams">Back to Exam Management</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const durationMs = result.completedAt - result.startedAt;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Exam Result Review</h2>
          <p className="text-sm text-muted-foreground">
            Immutable certificate review for {result.userSnapshot.fullName}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/admin/exams">Back to Exam Management</Link>
        </Button>
      </div>

      <Card className="border-border/70">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-xl">Certificate #{result.certificateNumber}</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Attempt #{result.attemptNumber} completed on {formatDateTime(result.completedAt)}
              </p>
            </div>
            <Badge
              className={
                result.passed
                  ? "border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                  : "border-red-200 bg-red-100 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200"
              }
            >
              {result.passed ? "Passed" : "Failed"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 rounded-md border bg-muted/20 p-4 text-sm md:grid-cols-2 xl:grid-cols-4">
            <div>
              <p className="text-muted-foreground">Cadet</p>
              <p className="font-medium">{result.userSnapshot.fullName}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Started</p>
              <p className="font-medium">{formatDateTime(result.startedAt)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Completed</p>
              <p className="font-medium">{formatDateTime(result.completedAt)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Duration</p>
              <p className="font-medium">{formatDuration(durationMs)}</p>
            </div>
          </div>

          <div className="grid gap-3 rounded-md border bg-background p-4 text-sm md:grid-cols-3">
            <div>
              <p className="text-muted-foreground">Score</p>
              <p className="text-lg font-semibold">{formatScorePercent(result.scorePercent)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Correct</p>
              <p className="text-lg font-semibold">
                {result.totalCorrect}/{result.totalQuestions}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Pass Threshold</p>
              <p className="text-lg font-semibold">{formatScorePercent(result.passThresholdPercent)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/70">
        <CardHeader>
          <CardTitle className="text-lg">Question-by-Question Review</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {result.questionBreakdown
            .slice()
            .sort((a, b) => a.questionIndex - b.questionIndex)
            .map((question) => {
              const selectedAnswerLabel = getOptionLabel(question.options, question.selectedAnswer);
              const correctAnswerLabel = getOptionLabel(question.options, question.correctAnswer);
              const showCorrectAnswer = question.isCorrect !== true;

              return (
                <div key={question.questionIndex} className="rounded-md border bg-background p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">Question {question.questionIndex + 1}</p>
                      <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                        {question.mode}
                      </Badge>
                    </div>
                    <Badge
                      className={
                        question.isCorrect
                          ? "border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                          : "border-red-200 bg-red-100 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200"
                      }
                    >
                      {question.isCorrect ? "Correct" : "Incorrect"}
                    </Badge>
                  </div>

                  <div className="mt-3 flex gap-3">
                    <div className="h-14 w-20 shrink-0 overflow-hidden rounded border bg-muted">
                      {question.flagImagePath ? (
                        <Image
                          src={question.flagImagePath}
                          alt={`${question.flagName} flag thumbnail`}
                          width={80}
                          height={56}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-[10px] text-muted-foreground">
                          No image
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1 space-y-1 text-sm">
                      <p className="font-medium">{question.flagName}</p>
                      <p className="text-xs text-muted-foreground">Category: {question.category}</p>
                      <p>
                        <span className="text-muted-foreground">Selected:</span>{" "}
                        <span className={question.isCorrect ? "font-medium" : "font-medium text-destructive"}>
                          {selectedAnswerLabel}
                        </span>
                      </p>
                      {showCorrectAnswer ? (
                        <p>
                          <span className="text-muted-foreground">Correct:</span>{" "}
                          <span className="font-medium">{correctAnswerLabel}</span>
                        </p>
                      ) : null}
                      <p className="text-xs text-muted-foreground">
                        Response time: {formatResponseTime(question.responseTimeMs)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
        </CardContent>
      </Card>

      <Card className="border-border/70">
        <CardHeader>
          <CardTitle className="text-lg">Integrity Investigation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 rounded-md border bg-background p-4 text-sm md:grid-cols-4">
            <div>
              <p className="text-muted-foreground">Integrity Score</p>
              <p className="text-lg font-semibold">
                {typeof result.integrityScore === "number" ? `${result.integrityScore.toFixed(0)}%` : "N/A"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Severity</p>
              <Badge className={integritySeverityClass}>
                {result.hasIntegrityFlags
                  ? (result.integritySeverity ?? "medium").toUpperCase()
                  : "CLEAR"}
              </Badge>
            </div>
            <div>
              <p className="text-muted-foreground">Avg Answer Time</p>
              <p className="font-medium">
                {typeof result.integritySignals?.averageAnswerTimeMs === "number"
                  ? `${(result.integritySignals.averageAnswerTimeMs / 1000).toFixed(2)}s`
                  : "N/A"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Timing Std Dev</p>
              <p className="font-medium">
                {typeof result.integritySignals?.answerTimeStdDevMs === "number"
                  ? `${(result.integritySignals.answerTimeStdDevMs / 1000).toFixed(2)}s`
                  : "N/A"}
              </p>
            </div>
          </div>

          <div className="rounded-md border bg-background p-4">
            <p className="mb-2 text-sm font-medium">Automated Flags</p>
            {result.integritySignals?.flags?.length ? (
              <div className="space-y-2">
                {result.integritySignals.flags.map((flag) => (
                  <div key={flag.ruleId} className="rounded border p-2 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      {flag.severity === "high" || flag.severity === "medium" ? (
                        <AlertTriangle className="h-4 w-4 text-amber-600" aria-hidden="true" />
                      ) : (
                        <ShieldCheck className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                      )}
                      <span className="font-medium">{flag.title}</span>
                      <Badge variant="outline" className="uppercase">
                        {flag.severity}
                      </Badge>
                    </div>
                    <p className="mt-1 text-muted-foreground">{flag.description}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No automated integrity flags were raised for this attempt.
              </p>
            )}
          </div>

          <div className="rounded-md border bg-background p-4">
            <div className="space-y-2">
              <Label htmlFor="investigation-notes">Manual Investigation Notes</Label>
              <textarea
                id="investigation-notes"
                value={notesDraft}
                onChange={(event) => setNotesDraft(event.target.value)}
                className="min-h-28 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm"
                placeholder="Add findings, follow-up actions, or context for this attempt..."
                disabled={isSavingNotes}
                aria-label="Manual investigation notes"
              />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  {result.investigationNotes
                    ? `Last updated ${formatDateTime(result.investigationNotes.updatedAt)}`
                    : "No notes saved yet."}
                </p>
                <Button
                  type="button"
                  variant="default"
                  onClick={() => void handleSaveInvestigationNotes()}
                  disabled={isSavingNotes}
                  aria-label="Save investigation notes"
                >
                  {isSavingNotes ? "Saving..." : "Save Notes"}
                </Button>
              </div>
              {notesStatusMessage ? (
                <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
                  {notesStatusMessage}
                </p>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
