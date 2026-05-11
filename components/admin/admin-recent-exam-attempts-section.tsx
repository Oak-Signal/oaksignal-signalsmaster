"use client";

import { useCallback, useEffect, useState } from "react";

import {
  ADMIN_EXAMS_DEFAULT_LIMIT,
  ADMIN_EXAMS_DEFAULT_PAGE,
  AdminRecentExamAttemptsPayload,
} from "@/lib/admin-exams-types";
import { AdminRecentExamAttemptsTable } from "@/components/admin/admin-recent-exam-attempts-table";

interface AdminExamsSuccessResponse {
  success: true;
  data: AdminRecentExamAttemptsPayload;
}

interface AdminExamsErrorResponse {
  success: false;
  error?: {
    message?: string;
  };
}

export function AdminRecentExamAttemptsSection() {
  const [page, setPage] = useState<number>(ADMIN_EXAMS_DEFAULT_PAGE);
  const [data, setData] = useState<AdminRecentExamAttemptsPayload | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchAttempts = useCallback(async (pageToLoad: number) => {
    setIsLoading(true);

    try {
      const params = new URLSearchParams({
        page: String(pageToLoad),
        limit: String(ADMIN_EXAMS_DEFAULT_LIMIT),
      });

      const response = await fetch(`/api/admin/exams?${params.toString()}`, {
        method: "GET",
        cache: "no-store",
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
        },
      });

      const body = (await response.json()) as
        | AdminExamsSuccessResponse
        | AdminExamsErrorResponse;

      if (!response.ok) {
        const message =
          body && "error" in body && body.error?.message
            ? body.error.message
            : "Unable to load recent exam attempts.";
        throw new Error(message);
      }

      if (!body || !("success" in body) || !body.success || !("data" in body)) {
        throw new Error("Unexpected recent exam attempts response.");
      }

      setData(body.data);
      setErrorMessage(null);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to load recent exam attempts.";
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAttempts(page);
  }, [fetchAttempts, page]);

  const pagination = data?.pagination ?? {
    page,
    limit: ADMIN_EXAMS_DEFAULT_LIMIT,
    totalCount: 0,
    totalPages: 0,
  };

  return (
    <div className="space-y-2">
      {errorMessage ? (
        <p className="text-sm text-destructive" role="status" aria-live="polite">
          {errorMessage}
        </p>
      ) : null}

      <AdminRecentExamAttemptsTable
        items={data?.items ?? []}
        pagination={pagination}
        isLoading={isLoading}
        onPageChange={setPage}
      />
    </div>
  );
}
