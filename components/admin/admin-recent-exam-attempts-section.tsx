"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  ADMIN_EXAMS_DEFAULT_LIMIT,
  AdminExamFiltersInput,
  AdminRecentExamAttemptsPayload,
} from "@/lib/admin-exams-types";
import {
  ADMIN_EXAMS_DEFAULT_FILTERS,
  AdminExamActiveFilterChip,
  buildAdminExamsQueryParams,
  getAdminExamActiveFilterChips,
  hasAnyActiveAdminExamFilters,
  parseAdminExamsQueryState,
} from "@/lib/admin-exams-filters";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { AdminActiveFilterChips } from "@/components/admin/admin-active-filter-chips";
import { AdminExamAttemptsFilters } from "@/components/admin/admin-exam-attempts-filters";
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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchParamsString = searchParams.toString();

  const queryState = useMemo(
    () => parseAdminExamsQueryState(new URLSearchParams(searchParamsString)),
    [searchParamsString]
  );
  const [draftFilters, setDraftFilters] = useState<AdminExamFiltersInput>(queryState.filters);
  const [data, setData] = useState<AdminRecentExamAttemptsPayload | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const debouncedCadetNameQuery = useDebouncedValue(draftFilters.cadetNameQuery ?? "", 300);
  const debouncedUserIdQuery = useDebouncedValue(draftFilters.userIdQuery ?? "", 300);

  useEffect(() => {
    setDraftFilters(queryState.filters);
  }, [queryState.filters]);

  const replaceQueryState = useCallback(
    (nextState: { page: number; limit: number; filters: AdminExamFiltersInput }) => {
      const params = buildAdminExamsQueryParams(nextState);
      const nextQueryString = params.toString();
      const currentQueryString = searchParamsString;
      if (nextQueryString === currentQueryString) {
        return;
      }

      router.replace(`${pathname}?${nextQueryString}`, { scroll: false });
    },
    [pathname, router, searchParamsString]
  );

  useEffect(() => {
    const normalizedCadetName = debouncedCadetNameQuery.trim() || undefined;
    const normalizedUserId = debouncedUserIdQuery.trim() || undefined;

    const nextFilters: AdminExamFiltersInput = {
      ...draftFilters,
      cadetNameQuery: normalizedCadetName,
      userIdQuery: normalizedUserId,
    };

    const hasFilterChanges =
      nextFilters.range !== queryState.filters.range ||
      nextFilters.customFrom !== queryState.filters.customFrom ||
      nextFilters.customTo !== queryState.filters.customTo ||
      nextFilters.passStatus !== queryState.filters.passStatus ||
      nextFilters.scoreMin !== queryState.filters.scoreMin ||
      nextFilters.scoreMax !== queryState.filters.scoreMax ||
      nextFilters.cadetNameQuery !== queryState.filters.cadetNameQuery ||
      nextFilters.userIdQuery !== queryState.filters.userIdQuery ||
      nextFilters.attemptFilter !== queryState.filters.attemptFilter;

    if (!hasFilterChanges) {
      return;
    }

    replaceQueryState({
      page: 1,
      limit: queryState.limit,
      filters: nextFilters,
    });
  }, [
    debouncedCadetNameQuery,
    debouncedUserIdQuery,
    draftFilters,
    queryState.filters,
    queryState.limit,
    replaceQueryState,
  ]);

  const fetchAttempts = useCallback(async () => {
    if (queryState.filters.range === "custom") {
      if (!queryState.filters.customFrom || !queryState.filters.customTo) {
        setData(null);
        setErrorMessage("Select both custom start and end dates to apply this filter.");
        setIsLoading(false);
        return;
      }
    }

    setIsLoading(true);

    try {
      const params = buildAdminExamsQueryParams(queryState);

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
  }, [queryState]);

  useEffect(() => {
    void fetchAttempts();
  }, [fetchAttempts]);

  const pagination = data?.pagination ?? {
    page: queryState.page,
    limit: queryState.limit,
    totalCount: 0,
    totalPages: 0,
  };

  const activeFilterChips = useMemo<AdminExamActiveFilterChip[]>(
    () => getAdminExamActiveFilterChips(queryState.filters),
    [queryState.filters]
  );

  const handlePageChange = useCallback(
    (nextPage: number) => {
      if (!Number.isInteger(nextPage) || nextPage < 1) {
        return;
      }

      if (pagination.totalPages > 0 && nextPage > pagination.totalPages) {
        return;
      }

      if (nextPage === queryState.page) {
        return;
      }

      replaceQueryState({
        page: nextPage,
        limit: queryState.limit,
        filters: queryState.filters,
      });
    },
    [pagination.totalPages, queryState.filters, queryState.limit, queryState.page, replaceQueryState]
  );

  const handleFiltersChange = useCallback((nextFilters: AdminExamFiltersInput) => {
    setDraftFilters(nextFilters);
  }, []);

  const handleClearAllFilters = useCallback(() => {
    setDraftFilters(ADMIN_EXAMS_DEFAULT_FILTERS);
    replaceQueryState({
      page: 1,
      limit: queryState.limit,
      filters: ADMIN_EXAMS_DEFAULT_FILTERS,
    });
  }, [queryState.limit, replaceQueryState]);

  const handleClearFilterChip = useCallback(
    (chipKey: AdminExamActiveFilterChip["key"]) => {
      const nextFilters: AdminExamFiltersInput = { ...queryState.filters };

      if (chipKey === "range") {
        nextFilters.range = ADMIN_EXAMS_DEFAULT_FILTERS.range;
        nextFilters.customFrom = undefined;
        nextFilters.customTo = undefined;
      } else if (chipKey === "passStatus") {
        nextFilters.passStatus = ADMIN_EXAMS_DEFAULT_FILTERS.passStatus;
      } else if (chipKey === "scoreRange") {
        nextFilters.scoreMin = ADMIN_EXAMS_DEFAULT_FILTERS.scoreMin;
        nextFilters.scoreMax = ADMIN_EXAMS_DEFAULT_FILTERS.scoreMax;
      } else if (chipKey === "cadetNameQuery") {
        nextFilters.cadetNameQuery = undefined;
      } else if (chipKey === "userIdQuery") {
        nextFilters.userIdQuery = undefined;
      } else if (chipKey === "attemptFilter") {
        nextFilters.attemptFilter = ADMIN_EXAMS_DEFAULT_FILTERS.attemptFilter;
      }

      setDraftFilters(nextFilters);
      replaceQueryState({
        page: 1,
        limit: queryState.limit,
        filters: nextFilters,
      });
    },
    [queryState.filters, queryState.limit, replaceQueryState]
  );

  return (
    <div className="space-y-3">
      <AdminExamAttemptsFilters
        filters={draftFilters}
        isLoading={isLoading}
        onFiltersChange={handleFiltersChange}
        onClearAllFilters={handleClearAllFilters}
      />

      <AdminActiveFilterChips
        chips={activeFilterChips}
        onClearChip={handleClearFilterChip}
      />

      {!hasAnyActiveAdminExamFilters(queryState.filters) ? (
        <p className="text-xs text-muted-foreground">No active filters. Showing default recent activity.</p>
      ) : null}

      {errorMessage ? (
        <p className="text-sm text-destructive" role="status" aria-live="polite">
          {errorMessage}
        </p>
      ) : null}

      <AdminRecentExamAttemptsTable
        items={data?.items ?? []}
        pagination={pagination}
        isLoading={isLoading}
        onPageChange={handlePageChange}
      />
    </div>
  );
}
