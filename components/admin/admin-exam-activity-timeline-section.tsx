"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  AdminExamActivityTimeline,
  type AdminStatsTimelineData,
  type AdminTimelineRange,
  type AdminTimelineView,
} from "@/components/admin/admin-exam-activity-timeline";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const TIMELINE_REFRESH_INTERVAL_MS = 30_000;

interface AdminTimelineSuccessResponse {
  success: true;
  data: AdminStatsTimelineData;
}

interface AdminTimelineErrorResponse {
  success: false;
  error?: {
    message?: string;
  };
}

const dateRangeOptions: Array<{ value: AdminTimelineRange; label: string }> = [
  { value: "7d", label: "Last 7 Days" },
  { value: "30d", label: "Last 30 Days" },
  { value: "90d", label: "Last 90 Days" },
];

const timelineViewOptions: Array<{ value: AdminTimelineView; label: string }> = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

export function AdminExamActivityTimelineSection() {
  const [range, setRange] = useState<AdminTimelineRange>("30d");
  const [view, setView] = useState<AdminTimelineView>("daily");
  const [timeline, setTimeline] = useState<AdminStatsTimelineData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const timeZone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    []
  );

  const fetchTimeline = useCallback(
    async (isBackgroundRefresh: boolean) => {
      if (!isBackgroundRefresh) {
        setIsLoading(true);
      }

      try {
        const params = new URLSearchParams({
          range,
          view,
          timeZone,
        });

        const response = await fetch(`/api/admin/stats/timeline?${params.toString()}`, {
          method: "GET",
          cache: "no-store",
          credentials: "same-origin",
          headers: {
            Accept: "application/json",
          },
        });

        const body = (await response.json()) as
          | AdminTimelineSuccessResponse
          | AdminTimelineErrorResponse;

        if (!response.ok) {
          const message =
            body && "error" in body && body.error?.message
              ? body.error.message
              : "Unable to load exam activity timeline.";
          throw new Error(message);
        }

        if (!body || !("success" in body) || !body.success || !("data" in body)) {
          throw new Error("Unexpected exam activity timeline response.");
        }

        setTimeline(body.data);
        setErrorMessage(null);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unable to load exam activity timeline.";
        setErrorMessage(message);
      } finally {
        if (!isBackgroundRefresh) {
          setIsLoading(false);
        }
      }
    },
    [range, timeZone, view]
  );

  useEffect(() => {
    void fetchTimeline(false);
  }, [fetchTimeline]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      void fetchTimeline(true);
    }, TIMELINE_REFRESH_INTERVAL_MS);

    return () => {
      clearInterval(intervalId);
    };
  }, [fetchTimeline]);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <Tabs
          value={range}
          onValueChange={(nextValue) => setRange(nextValue as AdminTimelineRange)}
          aria-label="Timeline date range"
        >
          <TabsList className="grid w-full grid-cols-3 md:w-auto">
            {dateRangeOptions.map((option) => (
              <TabsTrigger key={option.value} value={option.value} aria-label={option.label}>
                {option.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <Tabs
          value={view}
          onValueChange={(nextValue) => setView(nextValue as AdminTimelineView)}
          aria-label="Timeline grouping view"
        >
          <TabsList className="grid w-full grid-cols-3 md:w-auto">
            {timelineViewOptions.map((option) => (
              <TabsTrigger key={option.value} value={option.value} aria-label={option.label}>
                {option.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {errorMessage ? (
        <p className="text-sm text-destructive" role="status" aria-live="polite">
          {errorMessage}
        </p>
      ) : null}

      <AdminExamActivityTimeline data={timeline} isLoading={isLoading} />
    </div>
  );
}
