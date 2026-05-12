"use client";

import { ChangeEvent } from "react";

import {
  ADMIN_EXAMS_MAX_SCORE,
  ADMIN_EXAMS_MIN_SCORE,
  AdminExamCadetSuggestion,
  AdminExamFiltersInput,
} from "@/lib/admin-exams-types";
import { AdminCadetNameAutocomplete } from "@/components/admin/admin-cadet-name-autocomplete";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface AdminExamAttemptsFiltersProps {
  filters: AdminExamFiltersInput;
  isLoading?: boolean;
  onFiltersChange: (nextFilters: AdminExamFiltersInput) => void;
  onClearAllFilters: () => void;
}

function parseSliderValue(event: ChangeEvent<HTMLInputElement>): number {
  const parsed = Number(event.target.value);
  if (!Number.isFinite(parsed)) {
    return ADMIN_EXAMS_MIN_SCORE;
  }
  return Math.min(Math.max(parsed, ADMIN_EXAMS_MIN_SCORE), ADMIN_EXAMS_MAX_SCORE);
}

export function AdminExamAttemptsFilters({
  filters,
  isLoading = false,
  onFiltersChange,
  onClearAllFilters,
}: AdminExamAttemptsFiltersProps) {
  const handleCadetSuggestionSelect = (suggestion: AdminExamCadetSuggestion) => {
    onFiltersChange({
      ...filters,
      cadetNameQuery: suggestion.cadetName,
    });
  };

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Advanced Filters</h3>
          <p className="text-xs text-muted-foreground">
            Combine filters to find specific exam attempt records.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onClearAllFilters}
          disabled={isLoading}
          aria-label="Clear all filters"
        >
          Clear all filters
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <div>
          <label htmlFor="date-range-filter" className="text-xs font-medium text-muted-foreground">
            Date Range
          </label>
          <select
            id="date-range-filter"
            className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            value={filters.range}
            onChange={(event) =>
              onFiltersChange({
                ...filters,
                range: event.target.value as AdminExamFiltersInput["range"],
              })
            }
            disabled={isLoading}
            aria-label="Date range"
          >
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
            <option value="custom">Custom Range</option>
          </select>
        </div>

        <div>
          <label htmlFor="pass-status-filter" className="text-xs font-medium text-muted-foreground">
            Pass/Fail Status
          </label>
          <select
            id="pass-status-filter"
            className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            value={filters.passStatus}
            onChange={(event) =>
              onFiltersChange({
                ...filters,
                passStatus: event.target.value as AdminExamFiltersInput["passStatus"],
              })
            }
            disabled={isLoading}
            aria-label="Pass or fail status"
          >
            <option value="all">All</option>
            <option value="passed">Passed</option>
            <option value="failed">Failed</option>
          </select>
        </div>

        <div>
          <label htmlFor="attempt-filter" className="text-xs font-medium text-muted-foreground">
            Attempt Number
          </label>
          <select
            id="attempt-filter"
            className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            value={filters.attemptFilter}
            onChange={(event) =>
              onFiltersChange({
                ...filters,
                attemptFilter: event.target.value as AdminExamFiltersInput["attemptFilter"],
              })
            }
            disabled={isLoading}
            aria-label="Attempt number filter"
          >
            <option value="all">All attempts</option>
            <option value="first">1st attempts only</option>
            <option value="retake">Retakes only</option>
          </select>
        </div>
      </div>

      {filters.range === "custom" ? (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="custom-date-from" className="text-xs font-medium text-muted-foreground">
              From
            </label>
            <Input
              id="custom-date-from"
              type="date"
              value={filters.customFrom ?? ""}
              onChange={(event) =>
                onFiltersChange({
                  ...filters,
                  customFrom: event.target.value || undefined,
                })
              }
              disabled={isLoading}
              className="mt-1"
            />
          </div>
          <div>
            <label htmlFor="custom-date-to" className="text-xs font-medium text-muted-foreground">
              To
            </label>
            <Input
              id="custom-date-to"
              type="date"
              value={filters.customTo ?? ""}
              onChange={(event) =>
                onFiltersChange({
                  ...filters,
                  customTo: event.target.value || undefined,
                })
              }
              disabled={isLoading}
              className="mt-1"
            />
          </div>
        </div>
      ) : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div>
          <p className="text-xs font-medium text-muted-foreground">
            Score Range: {filters.scoreMin}% - {filters.scoreMax}%
          </p>
          <div className="mt-2 space-y-3">
            <div>
              <label htmlFor="score-min-filter" className="text-xs text-muted-foreground">
                Minimum score
              </label>
              <Input
                id="score-min-filter"
                type="range"
                min={ADMIN_EXAMS_MIN_SCORE}
                max={ADMIN_EXAMS_MAX_SCORE}
                step={1}
                value={filters.scoreMin}
                onChange={(event) => {
                  const nextMin = parseSliderValue(event);
                  onFiltersChange({
                    ...filters,
                    scoreMin: Math.min(nextMin, filters.scoreMax),
                  });
                }}
                disabled={isLoading}
                aria-label="Minimum score percentage"
              />
            </div>
            <div>
              <label htmlFor="score-max-filter" className="text-xs text-muted-foreground">
                Maximum score
              </label>
              <Input
                id="score-max-filter"
                type="range"
                min={ADMIN_EXAMS_MIN_SCORE}
                max={ADMIN_EXAMS_MAX_SCORE}
                step={1}
                value={filters.scoreMax}
                onChange={(event) => {
                  const nextMax = parseSliderValue(event);
                  onFiltersChange({
                    ...filters,
                    scoreMax: Math.max(nextMax, filters.scoreMin),
                  });
                }}
                disabled={isLoading}
                aria-label="Maximum score percentage"
              />
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <AdminCadetNameAutocomplete
            value={filters.cadetNameQuery ?? ""}
            onChange={(nextValue) =>
              onFiltersChange({
                ...filters,
                cadetNameQuery: nextValue || undefined,
              })
            }
            onSelectSuggestion={handleCadetSuggestionSelect}
            disabled={isLoading}
          />

          <div>
            <label htmlFor="user-id-search" className="text-xs font-medium text-muted-foreground">
              User ID
            </label>
            <Input
              id="user-id-search"
              type="text"
              placeholder="Search user ID..."
              value={filters.userIdQuery ?? ""}
              onChange={(event) =>
                onFiltersChange({
                  ...filters,
                  userIdQuery: event.target.value || undefined,
                })
              }
              disabled={isLoading}
              className="mt-1"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
