"use client";

import { useEffect, useState } from "react";

import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { ADMIN_EXAMS_SUGGESTIONS_DEFAULT_LIMIT, AdminExamCadetSuggestion } from "@/lib/admin-exams-types";
import { Input } from "@/components/ui/input";

interface AdminCadetSuggestionsSuccessResponse {
  success: true;
  data: AdminExamCadetSuggestion[];
}

interface AdminCadetSuggestionsErrorResponse {
  success: false;
  error?: {
    message?: string;
  };
}

interface AdminCadetNameAutocompleteProps {
  value: string;
  onChange: (nextValue: string) => void;
  onSelectSuggestion: (suggestion: AdminExamCadetSuggestion) => void;
  disabled?: boolean;
}

export function AdminCadetNameAutocomplete({
  value,
  onChange,
  onSelectSuggestion,
  disabled = false,
}: AdminCadetNameAutocompleteProps) {
  const debouncedQuery = useDebouncedValue(value.trim(), 300);
  const [suggestions, setSuggestions] = useState<AdminExamCadetSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    if (debouncedQuery.length === 0) {
      setSuggestions([]);
      setIsLoading(false);
      return;
    }

    const abortController = new AbortController();
    setIsLoading(true);

    const loadSuggestions = async () => {
      try {
        const params = new URLSearchParams({
          query: debouncedQuery,
          limit: String(ADMIN_EXAMS_SUGGESTIONS_DEFAULT_LIMIT),
        });

        const response = await fetch(
          `/api/admin/exams/cadet-suggestions?${params.toString()}`,
          {
            method: "GET",
            cache: "no-store",
            credentials: "same-origin",
            headers: {
              Accept: "application/json",
            },
            signal: abortController.signal,
          }
        );

        const body = (await response.json()) as
          | AdminCadetSuggestionsSuccessResponse
          | AdminCadetSuggestionsErrorResponse;

        if (!response.ok) {
          setSuggestions([]);
          return;
        }

        if (!body || !("success" in body) || !body.success || !("data" in body)) {
          setSuggestions([]);
          return;
        }

        setSuggestions(body.data);
      } catch {
        if (!abortController.signal.aborted) {
          setSuggestions([]);
        }
      } finally {
        if (!abortController.signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    void loadSuggestions();

    return () => {
      abortController.abort();
    };
  }, [debouncedQuery]);

  const hasSuggestions = suggestions.length > 0 && value.trim().length > 0;

  return (
    <div className="relative">
      <label htmlFor="cadet-name-search" className="text-xs font-medium text-muted-foreground">
        Cadet Name
      </label>
      <Input
        id="cadet-name-search"
        type="text"
        placeholder="Search cadet name..."
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete="off"
        disabled={disabled}
        role="combobox"
        aria-expanded={hasSuggestions}
        aria-controls="cadet-name-suggestions-listbox"
        aria-autocomplete="list"
        className="mt-1"
      />

      {isLoading ? (
        <p className="mt-1 text-xs text-muted-foreground" role="status" aria-live="polite">
          Loading suggestions...
        </p>
      ) : null}

      {hasSuggestions ? (
        <ul
          id="cadet-name-suggestions-listbox"
          role="listbox"
          className="absolute z-20 mt-1 w-full rounded-md border bg-background p-1 shadow-md"
        >
          {suggestions.map((suggestion) => (
            <li key={suggestion.userId} role="option" aria-selected="false">
              <button
                type="button"
                className="flex w-full items-start justify-between rounded-sm px-2 py-1 text-left text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onMouseDown={(event) => {
                  event.preventDefault();
                  onSelectSuggestion(suggestion);
                }}
              >
                <span className="font-medium">{suggestion.cadetName}</span>
                <span className="ml-3 text-xs text-muted-foreground">{suggestion.userId}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
