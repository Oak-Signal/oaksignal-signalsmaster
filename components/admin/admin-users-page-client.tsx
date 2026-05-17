"use client";

import Image from "next/image";
import Link from "next/link";
import { format } from "date-fns";
import { Download, Grid3X3, List, Search, UserCircle2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useDebouncedValue } from "@/hooks/use-debounced-value";
import {
  AdminUserBulkActionRequest,
  AdminUserBulkActionResponse,
  AdminExamPassFilter,
  AdminPracticeActivityLevel,
  AdminRankedParticipation,
  AdminSortDirection,
  AdminUserRole,
  AdminUsersApiErrorResponse,
  AdminUsersFilters,
  AdminUsersListItem,
  AdminUsersListResponse,
  AdminUsersSortBy,
  AdminUserStatus,
} from "@/lib/admin-user-management-types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface FilterPreset {
  name: string;
  filters: AdminUsersFilters;
}

interface UsersListState {
  items: AdminUsersListItem[];
  pagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
  };
  filtersApplied: AdminUsersFilters;
  generatedAt: number;
}

type ViewMode = "table" | "card";

const PRESET_STORAGE_KEY = "admin-users-filter-presets";

const SORTABLE_COLUMNS: Array<{ key: AdminUsersSortBy; label: string }> = [
  { key: "name", label: "Name" },
  { key: "email", label: "Email" },
  { key: "role", label: "Role" },
  { key: "createdAt", label: "Registration Date" },
  { key: "lastActiveAt", label: "Last Active" },
  { key: "status", label: "Status" },
];

function buildApiSearchParams(filters: AdminUsersFilters, page: number, limit: number): URLSearchParams {
  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("limit", String(limit));
  params.set("sortBy", filters.sortBy);
  params.set("sortDirection", filters.sortDirection);
  params.set("includeDeleted", String(filters.includeDeleted));

  if (filters.queryText) params.set("queryText", filters.queryText);
  if (filters.role) params.set("role", filters.role);
  if (filters.status) params.set("status", filters.status);
  if (filters.registeredFromMs !== undefined) params.set("registeredFromMs", String(filters.registeredFromMs));
  if (filters.registeredToMs !== undefined) params.set("registeredToMs", String(filters.registeredToMs));
  if (filters.lastActiveFromMs !== undefined) params.set("lastActiveFromMs", String(filters.lastActiveFromMs));
  if (filters.lastActiveToMs !== undefined) params.set("lastActiveToMs", String(filters.lastActiveToMs));
  if (filters.examPassFilter) params.set("examPassFilter", filters.examPassFilter);
  if (filters.practiceActivityLevel) params.set("practiceActivityLevel", filters.practiceActivityLevel);
  if (filters.rankedParticipation) params.set("rankedParticipation", filters.rankedParticipation);

  return params;
}

function formatDate(value: number | undefined): string {
  if (!value) {
    return "N/A";
  }

  return format(value, "PP p");
}

function toDateInputValue(timestamp: number | undefined): string {
  if (!timestamp) {
    return "";
  }

  const date = new Date(timestamp);
  return date.toISOString().slice(0, 10);
}

function parseDateInputAsMs(value: string, endOfDay: boolean): number | undefined {
  if (!value) {
    return undefined;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime())) {
    return undefined;
  }

  if (endOfDay) {
    date.setUTCHours(23, 59, 59, 999);
  }

  return date.getTime();
}

function roleBadgeVariant(role: AdminUserRole): "default" | "secondary" {
  return role === "admin" ? "default" : "secondary";
}

function statusBadgeClass(status: AdminUserStatus): string {
  if (status === "active") {
    return "border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200";
  }

  if (status === "suspended") {
    return "border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200";
  }

  if (status === "banned") {
    return "border-red-200 bg-red-100 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200";
  }

  return "border-blue-200 bg-blue-100 text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200";
}

function downloadCsv(filename: string, rows: string[][]): void {
  const csvContent = rows
    .map((row) => row.map((value) => `"${value.replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function defaultFilters(): AdminUsersFilters {
  return {
    includeDeleted: false,
    sortBy: "createdAt",
    sortDirection: "desc",
  };
}

function getApiErrorMessage(body: AdminUsersApiErrorResponse | null, fallback: string): string {
  if (body && "error" in body && body.error?.message) {
    return body.error.message;
  }

  return fallback;
}

export function AdminUsersPageClient() {
  const [usersState, setUsersState] = useState<UsersListState | null>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(100);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [isBulkSubmitting, setIsBulkSubmitting] = useState(false);
  const [isBulkConfirmOpen, setIsBulkConfirmOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [bulkActionMessage, setBulkActionMessage] = useState<string | null>(null);
  const [bulkFailures, setBulkFailures] = useState<Array<{ targetUserId: string; reason: string }>>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

  const [queryText, setQueryText] = useState("");
  const debouncedQueryText = useDebouncedValue(queryText, 350);

  const [filters, setFilters] = useState<AdminUsersFilters>(defaultFilters());
  const [presets, setPresets] = useState<FilterPreset[]>([]);
  const [bulkOperation, setBulkOperation] = useState<"set_role" | "set_status">("set_status");
  const [bulkNextRole, setBulkNextRole] = useState<AdminUserRole>("cadet");
  const [bulkNextStatus, setBulkNextStatus] = useState<AdminUserStatus>("active");
  const [bulkReason, setBulkReason] = useState("");
  const [bulkNotifyUser, setBulkNotifyUser] = useState(false);

  const allVisibleSelected =
    usersState !== null &&
    usersState.items.length > 0 &&
    usersState.items.every((user) => selectedUserIds.includes(user.userId));

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(PRESET_STORAGE_KEY);
      if (!raw) {
        return;
      }

      const parsed = JSON.parse(raw) as FilterPreset[];
      if (Array.isArray(parsed)) {
        setPresets(parsed);
      }
    } catch {
      setPresets([]);
    }
  }, []);

  const persistPresets = useCallback((nextPresets: FilterPreset[]) => {
    setPresets(nextPresets);
    window.localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(nextPresets));
  }, []);

  const effectiveFilters = useMemo(
    () => ({
      ...filters,
      queryText: debouncedQueryText || undefined,
    }),
    [debouncedQueryText, filters]
  );

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);

    try {
      const params = buildApiSearchParams(effectiveFilters, page, limit);
      const response = await fetch(`/api/admin/users?${params.toString()}`, {
        method: "GET",
        cache: "no-store",
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
        },
      });

      const body = (await response.json()) as AdminUsersListResponse | AdminUsersApiErrorResponse;

      if (!response.ok) {
        const message =
          body && "error" in body && body.error?.message
            ? body.error.message
            : "Unable to load users.";
        throw new Error(message);
      }

      if (!body || !("success" in body) || !body.success || !("data" in body)) {
        throw new Error("Unexpected users response.");
      }

      setUsersState(body.data);
      setErrorMessage(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load users.";
      setErrorMessage(message);
      setUsersState(null);
    } finally {
      setIsLoading(false);
    }
  }, [effectiveFilters, limit, page]);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    if (!usersState) {
      return;
    }

    setSelectedUserIds((current) =>
      current.filter((selectedId) => usersState.items.some((item) => item.userId === selectedId))
    );
  }, [usersState]);

  const toggleSelectAllVisible = (checked: boolean) => {
    if (!usersState) {
      return;
    }

    if (checked) {
      setSelectedUserIds((current) => {
        const next = new Set(current);
        for (const item of usersState.items) {
          next.add(item.userId);
        }
        return Array.from(next);
      });
      return;
    }

    setSelectedUserIds((current) =>
      current.filter((selectedId) => !usersState.items.some((item) => item.userId === selectedId))
    );
  };

  const toggleSelectUser = (userId: string, checked: boolean) => {
    if (checked) {
      setSelectedUserIds((current) => (current.includes(userId) ? current : [...current, userId]));
      return;
    }

    setSelectedUserIds((current) => current.filter((id) => id !== userId));
  };

  const executeBulkAction = async () => {
    const payload: AdminUserBulkActionRequest = {
      targetUserIds: selectedUserIds,
      operation: bulkOperation,
      reason: bulkReason.trim(),
      notifyUser: bulkNotifyUser,
      nextRole: bulkOperation === "set_role" ? bulkNextRole : undefined,
      nextStatus: bulkOperation === "set_status" ? bulkNextStatus : undefined,
    };

    setIsBulkSubmitting(true);
    setBulkActionMessage(null);
    setBulkFailures([]);

    try {
      const response = await fetch("/api/admin/users/bulk", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      const body = (await response.json()) as AdminUserBulkActionResponse | AdminUsersApiErrorResponse;

      if (!response.ok || !("success" in body) || !body.success) {
        throw new Error(getApiErrorMessage(body as AdminUsersApiErrorResponse, "Bulk action failed."));
      }

      const failedCount = body.data.failed;
      const summaryMessage =
        failedCount > 0
          ? `Bulk action completed with ${failedCount} failures out of ${body.data.processed} users.`
          : `Bulk action completed for ${body.data.changed} users.`;

      setBulkActionMessage(summaryMessage);
      setBulkFailures(body.data.failures ?? []);
      setSelectedUserIds([]);
      setIsBulkConfirmOpen(false);
      await fetchUsers();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Bulk action failed.";
      setBulkActionMessage(message);
    } finally {
      setIsBulkSubmitting(false);
    }
  };

  const handleSubmitBulkAction = () => {
    if (selectedUserIds.length === 0) {
      setBulkActionMessage("Select at least one user for bulk actions.");
      return;
    }

    if (bulkReason.trim().length === 0) {
      setBulkActionMessage("Reason is required for bulk actions.");
      return;
    }

    setIsBulkConfirmOpen(true);
  };

  const handleSort = (column: AdminUsersSortBy) => {
    setPage(1);
    setFilters((current) => {
      const sameColumn = current.sortBy === column;
      const nextDirection: AdminSortDirection = sameColumn
        ? current.sortDirection === "asc"
          ? "desc"
          : "asc"
        : "asc";

      return {
        ...current,
        sortBy: column,
        sortDirection: nextDirection,
      };
    });
  };

  const handleResetFilters = () => {
    setQueryText("");
    setPage(1);
    setFilters(defaultFilters());
  };

  const handleSavePreset = () => {
    const name = window.prompt("Preset name");
    if (!name || name.trim().length === 0) {
      return;
    }

    const normalizedName = name.trim();
    const nextPresets = [
      {
        name: normalizedName,
        filters: effectiveFilters,
      },
      ...presets.filter((preset) => preset.name.toLowerCase() !== normalizedName.toLowerCase()),
    ].slice(0, 10);

    persistPresets(nextPresets);
  };

  const handleApplyPreset = (presetName: string) => {
    const preset = presets.find((item) => item.name === presetName);
    if (!preset) {
      return;
    }

    setPage(1);
    setQueryText(preset.filters.queryText ?? "");
    setFilters({
      ...preset.filters,
      queryText: undefined,
    });
  };

  const handleDeletePreset = (presetName: string) => {
    const nextPresets = presets.filter((preset) => preset.name !== presetName);
    persistPresets(nextPresets);
  };

  const handleExportFilteredCsv = async () => {
    setIsExporting(true);

    try {
      const rows: string[][] = [[
        "User ID",
        "Name",
        "Email",
        "Role",
        "Status",
        "Registration Date",
        "Last Active",
        "Online",
      ]];

      let exportPage = 1;
      let totalPages = 1;

      while (exportPage <= totalPages) {
        const params = buildApiSearchParams(effectiveFilters, exportPage, 250);
        const response = await fetch(`/api/admin/users?${params.toString()}`, {
          method: "GET",
          cache: "no-store",
          credentials: "same-origin",
          headers: {
            Accept: "application/json",
          },
        });

        const body = (await response.json()) as AdminUsersListResponse | AdminUsersApiErrorResponse;
        if (!response.ok || !("success" in body) || !body.success) {
          throw new Error("Unable to export users.");
        }

        for (const item of body.data.items) {
          rows.push([
            item.userId,
            item.name ?? "",
            item.email,
            item.role,
            item.status,
            formatDate(item.createdAt),
            formatDate(item.lastActiveAt),
            item.isOnline ? "Yes" : "No",
          ]);
        }

        totalPages = body.data.pagination.totalPages;
        exportPage += 1;
      }

      downloadCsv(`users-export-${Date.now()}.csv`, rows);
    } catch {
      setErrorMessage("Failed to export users to CSV.");
    } finally {
      setIsExporting(false);
    }
  };

  const users = usersState?.items ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">User Management</h2>
          <p className="text-muted-foreground">
            Review user accounts, activity snapshots, and profile-level details.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant={viewMode === "table" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("table")}
            aria-label="Use table view"
          >
            <List className="mr-2 h-4 w-4" />
            Table
          </Button>
          <Button
            type="button"
            variant={viewMode === "card" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("card")}
            aria-label="Use card view"
          >
            <Grid3X3 className="mr-2 h-4 w-4" />
            Cards
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void handleExportFilteredCsv()}
            disabled={isExporting}
            aria-label="Export filtered users"
          >
            <Download className="mr-2 h-4 w-4" />
            {isExporting ? "Exporting..." : "Export CSV"}
          </Button>
        </div>
      </div>

      <Card className="border-border/70">
        <CardHeader>
          <CardTitle className="text-xl">Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2 lg:col-span-2">
              <Label htmlFor="users-search">Search</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="users-search"
                  value={queryText}
                  onChange={(event) => {
                    setPage(1);
                    setQueryText(event.target.value);
                  }}
                  placeholder="Name, email, or user ID"
                  className="pl-9"
                  aria-label="Search users"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="users-role">Role</Label>
              <select
                id="users-role"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                value={filters.role ?? "all"}
                onChange={(event) => {
                  setPage(1);
                  setFilters((current) => ({
                    ...current,
                    role:
                      event.target.value === "all"
                        ? undefined
                        : (event.target.value as AdminUserRole),
                  }));
                }}
                aria-label="Filter by role"
              >
                <option value="all">All roles</option>
                <option value="admin">Administrator</option>
                <option value="cadet">Cadet</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="users-status">Status</Label>
              <select
                id="users-status"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                value={filters.status ?? "all"}
                onChange={(event) => {
                  setPage(1);
                  setFilters((current) => ({
                    ...current,
                    status:
                      event.target.value === "all"
                        ? undefined
                        : (event.target.value as AdminUserStatus),
                  }));
                }}
                aria-label="Filter by status"
              >
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
                <option value="banned">Banned</option>
                <option value="pending_verification">Pending verification</option>
              </select>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="users-registered-from">Registered From</Label>
              <Input
                id="users-registered-from"
                type="date"
                value={toDateInputValue(filters.registeredFromMs)}
                onChange={(event) => {
                  setPage(1);
                  setFilters((current) => ({
                    ...current,
                    registeredFromMs: parseDateInputAsMs(event.target.value, false),
                  }));
                }}
                aria-label="Registration date from"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="users-registered-to">Registered To</Label>
              <Input
                id="users-registered-to"
                type="date"
                value={toDateInputValue(filters.registeredToMs)}
                onChange={(event) => {
                  setPage(1);
                  setFilters((current) => ({
                    ...current,
                    registeredToMs: parseDateInputAsMs(event.target.value, true),
                  }));
                }}
                aria-label="Registration date to"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="users-last-active-from">Last Active From</Label>
              <Input
                id="users-last-active-from"
                type="date"
                value={toDateInputValue(filters.lastActiveFromMs)}
                onChange={(event) => {
                  setPage(1);
                  setFilters((current) => ({
                    ...current,
                    lastActiveFromMs: parseDateInputAsMs(event.target.value, false),
                  }));
                }}
                aria-label="Last active date from"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="users-last-active-to">Last Active To</Label>
              <Input
                id="users-last-active-to"
                type="date"
                value={toDateInputValue(filters.lastActiveToMs)}
                onChange={(event) => {
                  setPage(1);
                  setFilters((current) => ({
                    ...current,
                    lastActiveToMs: parseDateInputAsMs(event.target.value, true),
                  }));
                }}
                aria-label="Last active date to"
              />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="users-exam-pass">Exam Pass Status</Label>
              <select
                id="users-exam-pass"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                value={filters.examPassFilter ?? "all"}
                onChange={(event) => {
                  setPage(1);
                  setFilters((current) => ({
                    ...current,
                    examPassFilter:
                      event.target.value === "all"
                        ? undefined
                        : (event.target.value as AdminExamPassFilter),
                  }));
                }}
                aria-label="Filter by exam pass status"
              >
                <option value="all">All</option>
                <option value="passed">Passed</option>
                <option value="failed">Failed</option>
                <option value="no_attempt">No attempt</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="users-practice-activity">Practice Activity</Label>
              <select
                id="users-practice-activity"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                value={filters.practiceActivityLevel ?? "all"}
                onChange={(event) => {
                  setPage(1);
                  setFilters((current) => ({
                    ...current,
                    practiceActivityLevel:
                      event.target.value === "all"
                        ? undefined
                        : (event.target.value as AdminPracticeActivityLevel),
                  }));
                }}
                aria-label="Filter by practice activity"
              >
                <option value="all">All</option>
                <option value="none">None</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="users-ranked-participation">Ranked Participation</Label>
              <select
                id="users-ranked-participation"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                value={filters.rankedParticipation ?? "all"}
                onChange={(event) => {
                  setPage(1);
                  setFilters((current) => ({
                    ...current,
                    rankedParticipation:
                      event.target.value === "all"
                        ? undefined
                        : (event.target.value as AdminRankedParticipation),
                  }));
                }}
                aria-label="Filter by ranked participation"
              >
                <option value="all">All</option>
                <option value="participated">Participated</option>
                <option value="not_participated">Not participated</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="users-page-size">Rows per page</Label>
              <select
                id="users-page-size"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                value={String(limit)}
                onChange={(event) => {
                  setPage(1);
                  setLimit(Number(event.target.value));
                }}
                aria-label="Set page size"
              >
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
                <option value="200">200</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" onClick={handleResetFilters} aria-label="Reset all filters">
              Reset Filters
            </Button>
            <Button type="button" variant="outline" onClick={handleSavePreset} aria-label="Save filter preset">
              Save Preset
            </Button>
            <select
              className="flex h-9 min-w-55 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              value=""
              onChange={(event) => {
                if (!event.target.value) {
                  return;
                }
                handleApplyPreset(event.target.value);
              }}
              aria-label="Apply saved filter preset"
            >
              <option value="">Apply preset...</option>
              {presets.map((preset) => (
                <option key={preset.name} value={preset.name}>
                  {preset.name}
                </option>
              ))}
            </select>
            {presets.length > 0 ? (
              <select
                className="flex h-9 min-w-55 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                value=""
                onChange={(event) => {
                  if (!event.target.value) {
                    return;
                  }
                  handleDeletePreset(event.target.value);
                }}
                aria-label="Delete saved filter preset"
              >
                <option value="">Delete preset...</option>
                {presets.map((preset) => (
                  <option key={preset.name} value={preset.name}>
                    {preset.name}
                  </option>
                ))}
              </select>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Total users: <span className="font-medium text-foreground">{usersState?.pagination.totalCount ?? 0}</span>
        </p>
        {usersState ? (
          <p className="text-xs text-muted-foreground">Updated {formatDate(usersState.generatedAt)}</p>
        ) : null}
      </div>

      <Card className="border-border/70">
        <CardHeader>
          <CardTitle className="text-base">Bulk Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {selectedUserIds.length} user{selectedUserIds.length === 1 ? "" : "s"} selected.
          </p>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-2">
              <Label htmlFor="bulk-operation">Operation</Label>
              <select
                id="bulk-operation"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                value={bulkOperation}
                onChange={(event) => setBulkOperation(event.target.value as "set_role" | "set_status")}
                aria-label="Select bulk operation"
                disabled={isBulkSubmitting}
              >
                <option value="set_status">Set status</option>
                <option value="set_role">Set role</option>
              </select>
            </div>

            {bulkOperation === "set_role" ? (
              <div className="space-y-2">
                <Label htmlFor="bulk-next-role">New Role</Label>
                <select
                  id="bulk-next-role"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                  value={bulkNextRole}
                  onChange={(event) => setBulkNextRole(event.target.value as AdminUserRole)}
                  aria-label="Select target role"
                  disabled={isBulkSubmitting}
                >
                  <option value="admin">Administrator</option>
                  <option value="cadet">Cadet</option>
                </select>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="bulk-next-status">New Status</Label>
                <select
                  id="bulk-next-status"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                  value={bulkNextStatus}
                  onChange={(event) => setBulkNextStatus(event.target.value as AdminUserStatus)}
                  aria-label="Select target status"
                  disabled={isBulkSubmitting}
                >
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                  <option value="banned">Banned</option>
                  <option value="pending_verification">Pending verification</option>
                </select>
              </div>
            )}

            <div className="space-y-2 lg:col-span-2">
              <Label htmlFor="bulk-reason">Reason</Label>
              <Input
                id="bulk-reason"
                value={bulkReason}
                onChange={(event) => setBulkReason(event.target.value)}
                placeholder="Why is this bulk action needed?"
                aria-label="Bulk action reason"
                disabled={isBulkSubmitting}
              />
            </div>

            <div className="flex items-end gap-3">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={bulkNotifyUser}
                  onCheckedChange={(checked) => setBulkNotifyUser(checked === true)}
                  aria-label="Notify affected users"
                  disabled={isBulkSubmitting}
                />
                Notify users
              </label>
              <Button
                type="button"
                onClick={() => void handleSubmitBulkAction()}
                disabled={selectedUserIds.length === 0 || isBulkSubmitting}
                aria-label="Submit bulk action"
              >
                {isBulkSubmitting ? "Applying..." : "Apply"}
              </Button>
            </div>
          </div>

          {bulkActionMessage ? (
            <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
              {bulkActionMessage}
            </p>
          ) : null}

          {bulkFailures.length > 0 ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30">
              <p className="text-sm font-medium">Bulk failures</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                {bulkFailures.map((failure) => (
                  <li key={`${failure.targetUserId}-${failure.reason}`}>
                    {failure.targetUserId}: {failure.reason}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={isBulkConfirmOpen} onOpenChange={setIsBulkConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Bulk Action</DialogTitle>
            <DialogDescription>
              Apply {bulkOperation === "set_role" ? "role" : "status"} updates to {selectedUserIds.length} selected users.
              This action will be logged.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsBulkConfirmOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void executeBulkAction()} disabled={isBulkSubmitting}>
              {isBulkSubmitting ? "Applying..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}

      {isLoading ? <p className="text-sm text-muted-foreground">Loading users...</p> : null}

      {!isLoading && users.length === 0 && !errorMessage ? (
        <Card>
          <CardContent className="py-8">
            <p className="text-sm text-muted-foreground">No users matched the current filters.</p>
          </CardContent>
        </Card>
      ) : null}

      {!isLoading && users.length > 0 ? (
        <>
          {viewMode === "table" ? (
            <Card className="border-border/70">
              <CardContent className="overflow-x-auto p-0">
                <table className="w-full min-w-230 text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="px-4 py-3 text-left font-medium">
                        <Checkbox
                          checked={allVisibleSelected}
                          onCheckedChange={(checked) => toggleSelectAllVisible(checked === true)}
                          aria-label="Select all visible users"
                        />
                      </th>
                      {SORTABLE_COLUMNS.map((column) => (
                        <th key={column.key} className="px-4 py-3 text-left font-medium">
                          <button
                            type="button"
                            onClick={() => handleSort(column.key)}
                            className="inline-flex items-center gap-2 hover:text-primary"
                            aria-label={`Sort by ${column.label}`}
                          >
                            {column.label}
                            {filters.sortBy === column.key ? (
                              <span className="text-xs">{filters.sortDirection === "asc" ? "▲" : "▼"}</span>
                            ) : null}
                          </button>
                        </th>
                      ))}
                      <th className="px-4 py-3 text-left font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.userId} className="border-b align-top">
                        <td className="px-4 py-3">
                          <Checkbox
                            checked={selectedUserIds.includes(user.userId)}
                            onCheckedChange={(checked) => toggleSelectUser(user.userId, checked === true)}
                            aria-label={`Select user ${user.name ?? user.email}`}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {user.avatarUrl ? (
                              <Image
                                src={user.avatarUrl}
                                alt={`${user.name ?? user.email} avatar`}
                                width={32}
                                height={32}
                                className="h-8 w-8 rounded-full object-cover"
                              />
                            ) : (
                              <UserCircle2 className="h-8 w-8 text-muted-foreground" />
                            )}
                            <div>
                              <p className="font-medium">{user.name ?? "Unnamed user"}</p>
                              <div className="flex items-center gap-2">
                                <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden={!user.isOnline} />
                                <span className="text-xs text-muted-foreground">
                                  {user.isOnline ? "Online" : "Offline"}
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">{user.email}</td>
                        <td className="px-4 py-3">
                          <Badge variant={roleBadgeVariant(user.role)}>
                            {user.role === "admin" ? "Administrator" : "Cadet"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">{formatDate(user.createdAt)}</td>
                        <td className="px-4 py-3">{formatDate(user.lastActiveAt)}</td>
                        <td className="px-4 py-3">
                          <Badge className={statusBadgeClass(user.status)}>{user.status}</Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Button asChild variant="outline" size="sm">
                            <Link href={`/admin/users/${user.userId}`}>View Profile</Link>
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {users.map((user) => (
                <Card key={user.userId} className="border-border/70">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center justify-between text-base">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={selectedUserIds.includes(user.userId)}
                          onCheckedChange={(checked) => toggleSelectUser(user.userId, checked === true)}
                          aria-label={`Select user ${user.name ?? user.email}`}
                        />
                        <span className="truncate">{user.name ?? "Unnamed user"}</span>
                      </div>
                      <span
                        className={`h-2.5 w-2.5 rounded-full ${user.isOnline ? "bg-emerald-500" : "bg-zinc-400"}`}
                      />
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <p className="truncate text-muted-foreground">{user.email}</p>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={roleBadgeVariant(user.role)}>
                        {user.role === "admin" ? "Administrator" : "Cadet"}
                      </Badge>
                      <Badge className={statusBadgeClass(user.status)}>{user.status}</Badge>
                    </div>
                    <p>Registered: {formatDate(user.createdAt)}</p>
                    <p>Last active: {formatDate(user.lastActiveAt)}</p>
                    <Button asChild variant="outline" size="sm" className="mt-2 w-full">
                      <Link href={`/admin/users/${user.userId}`}>View Profile</Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              Page {usersState?.pagination.page ?? 1} of {usersState?.pagination.totalPages ?? 1}
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={!usersState || usersState.pagination.page <= 1 || isLoading}
                aria-label="Go to previous page"
              >
                Previous
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPage((current) => current + 1)}
                disabled={
                  !usersState ||
                  usersState.pagination.totalPages === 0 ||
                  usersState.pagination.page >= usersState.pagination.totalPages ||
                  isLoading
                }
                aria-label="Go to next page"
              >
                Next
              </Button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
