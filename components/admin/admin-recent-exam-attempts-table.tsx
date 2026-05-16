"use client";

import Link from "next/link";
import { format } from "date-fns";
import { AlertTriangle } from "lucide-react";

import {
  AdminRecentExamAttemptItem,
  AdminRecentExamAttemptsPagination,
} from "@/lib/admin-exams-types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface AdminRecentExamAttemptsTableProps {
  items: AdminRecentExamAttemptItem[];
  pagination: AdminRecentExamAttemptsPagination;
  isLoading?: boolean;
  onPageChange: (page: number) => void;
}

function formatScorePercent(score: number): string {
  return `${score.toFixed(2)}%`;
}

function formatCompletedAt(timestamp: number): string {
  return format(timestamp, "PPp");
}

function formatDuration(durationMs: number | null): string {
  if (durationMs === null || durationMs < 0) {
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

function formatIntegrityScore(score: number | undefined): string {
  if (typeof score !== "number" || !Number.isFinite(score)) {
    return "N/A";
  }

  return `${score.toFixed(0)}%`;
}

function getIntegritySeverityBadgeClass(severity: "low" | "medium" | "high" | undefined): string {
  if (severity === "high") {
    return "border-red-200 bg-red-100 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200";
  }

  if (severity === "medium") {
    return "border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200";
  }

  return "border-slate-200 bg-slate-100 text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200";
}

function getPageNumbers(currentPage: number, totalPages: number): number[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages = new Set<number>([1, totalPages, currentPage - 1, currentPage, currentPage + 1]);
  return [...pages].filter((page) => page >= 1 && page <= totalPages).sort((a, b) => a - b);
}

function LoadingRows() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, index) => (
        <tr key={`loading-row-${index}`} className="border-b last:border-b-0">
          <td className="px-4 py-3"><Skeleton className="h-4 w-32" /></td>
          <td className="px-4 py-3"><Skeleton className="h-4 w-40" /></td>
          <td className="px-4 py-3"><Skeleton className="h-4 w-16" /></td>
          <td className="px-4 py-3"><Skeleton className="h-6 w-28 rounded-full" /></td>
          <td className="px-4 py-3"><Skeleton className="h-6 w-20 rounded-full" /></td>
          <td className="px-4 py-3"><Skeleton className="h-4 w-14" /></td>
        </tr>
      ))}
    </>
  );
}

export function AdminRecentExamAttemptsTable({
  items,
  pagination,
  isLoading = false,
  onPageChange,
}: AdminRecentExamAttemptsTableProps) {
  const hasItems = items.length > 0;
  const pageNumbers = getPageNumbers(pagination.page, pagination.totalPages);
  const canGoPrevious = pagination.page > 1;
  const canGoNext = pagination.page < pagination.totalPages;

  return (
    <Card className="border-border/70">
      <CardHeader>
        <CardTitle>Recent Exam Attempts</CardTitle>
        <CardDescription>
          Review the latest completed official exam activity.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="overflow-x-auto rounded-md border" aria-busy={isLoading}>
          <table className="w-full min-w-190 text-sm" aria-label="Recent exam attempts">
            <thead className="bg-muted/50">
              <tr>
                <th scope="col" className="px-4 py-3 text-left font-medium">Cadet</th>
                <th scope="col" className="px-4 py-3 text-left font-medium">Date/Time</th>
                <th scope="col" className="px-4 py-3 text-left font-medium">Score</th>
                <th scope="col" className="px-4 py-3 text-left font-medium">Integrity</th>
                <th scope="col" className="px-4 py-3 text-left font-medium">Status</th>
                <th scope="col" className="px-4 py-3 text-left font-medium">Duration</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <LoadingRows />
              ) : hasItems ? (
                items.map((item) => (
                  <tr key={item.examResultId} className="border-b transition-colors hover:bg-muted/30 last:border-b-0">
                    <td className="px-4 py-3 font-medium">
                      <Link
                        href={`/admin/exams/${item.examResultId}`}
                        className="rounded-sm underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        aria-label={`Open exam review for ${item.cadetName}`}
                      >
                        {item.cadetName}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{formatCompletedAt(item.completedAt)}</td>
                    <td className="px-4 py-3">{formatScorePercent(item.scorePercent)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {item.hasIntegrityFlags ? (
                          <AlertTriangle className="h-4 w-4 text-amber-600" aria-hidden="true" />
                        ) : null}
                        <span className="font-medium">{formatIntegrityScore(item.integrityScore)}</span>
                        <Badge className={getIntegritySeverityBadgeClass(item.integritySeverity)}>
                          {item.hasIntegrityFlags
                            ? (item.integritySeverity ?? "medium").toUpperCase()
                            : "CLEAR"}
                        </Badge>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        className={
                          item.passed
                            ? "border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                            : "border-red-200 bg-red-100 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200"
                        }
                      >
                        {item.passed ? "Passed" : "Failed"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDuration(item.durationMs)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                    No exams found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            {pagination.totalCount === 0
              ? "0 results"
              : `Showing page ${pagination.page} of ${Math.max(pagination.totalPages, 1)} (${pagination.totalCount} total)`}
          </p>

          <div className="flex flex-wrap items-center gap-2" role="navigation" aria-label="Pagination">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onPageChange(pagination.page - 1)}
              disabled={!canGoPrevious || isLoading}
              aria-label="Go to previous page"
            >
              Previous
            </Button>

            {pageNumbers.map((pageNumber) => (
              <Button
                key={pageNumber}
                type="button"
                variant={pageNumber === pagination.page ? "default" : "outline"}
                size="sm"
                onClick={() => onPageChange(pageNumber)}
                disabled={isLoading}
                aria-label={`Go to page ${pageNumber}`}
                aria-current={pageNumber === pagination.page ? "page" : undefined}
              >
                {pageNumber}
              </Button>
            ))}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onPageChange(pagination.page + 1)}
              disabled={!canGoNext || isLoading}
              aria-label="Go to next page"
            >
              Next
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
