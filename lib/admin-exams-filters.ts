import {
  ADMIN_EXAMS_DEFAULT_LIMIT,
  ADMIN_EXAMS_DEFAULT_PAGE,
  ADMIN_EXAMS_MAX_SCORE,
  ADMIN_EXAMS_MIN_SCORE,
  AdminExamAttemptFilter,
  AdminExamDateRange,
  AdminExamFiltersInput,
  AdminExamPassStatus,
} from "@/lib/admin-exams-types";

const DATE_INPUT_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export interface AdminExamsQueryState {
  page: number;
  limit: number;
  filters: AdminExamFiltersInput;
}

export interface AdminExamActiveFilterChip {
  key:
    | "range"
    | "passStatus"
    | "scoreRange"
    | "flaggedOnly"
    | "integrityScoreRange"
    | "cadetNameQuery"
    | "userIdQuery"
    | "attemptFilter";
  label: string;
}

interface SearchParamReader {
  get(name: string): string | null;
}

export const ADMIN_EXAMS_DEFAULT_FILTERS: AdminExamFiltersInput = {
  range: "30d",
  passStatus: "all",
  scoreMin: ADMIN_EXAMS_MIN_SCORE,
  scoreMax: ADMIN_EXAMS_MAX_SCORE,
  attemptFilter: "all",
  flaggedOnly: false,
  integrityScoreMin: ADMIN_EXAMS_MIN_SCORE,
  integrityScoreMax: ADMIN_EXAMS_MAX_SCORE,
};

function clampScore(value: number): number {
  if (!Number.isFinite(value)) {
    return ADMIN_EXAMS_MIN_SCORE;
  }
  return Math.min(Math.max(value, ADMIN_EXAMS_MIN_SCORE), ADMIN_EXAMS_MAX_SCORE);
}

function parsePositiveInteger(value: string | null, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return fallback;
  }

  return parsed;
}

function parseRange(value: string | null): AdminExamDateRange {
  if (value === "7d" || value === "30d" || value === "90d" || value === "custom") {
    return value;
  }
  return ADMIN_EXAMS_DEFAULT_FILTERS.range;
}

function parsePassStatus(value: string | null): AdminExamPassStatus {
  if (value === "passed" || value === "failed" || value === "all") {
    return value;
  }
  return ADMIN_EXAMS_DEFAULT_FILTERS.passStatus;
}

function parseAttemptFilter(value: string | null): AdminExamAttemptFilter {
  if (value === "all" || value === "first" || value === "retake") {
    return value;
  }
  return ADMIN_EXAMS_DEFAULT_FILTERS.attemptFilter;
}

function parseDateInput(value: string | null): string | undefined {
  if (!value) {
    return undefined;
  }
  return DATE_INPUT_REGEX.test(value) ? value : undefined;
}

function parseOptionalQuery(value: string | null): string | undefined {
  if (!value) {
    return undefined;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function parseBoolean(value: string | null, fallback: boolean): boolean {
  if (!value) {
    return fallback;
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return fallback;
}

export function parseAdminExamsQueryState(searchParams: SearchParamReader): AdminExamsQueryState {
  const scoreMinRaw = searchParams.get("scoreMin");
  const scoreMaxRaw = searchParams.get("scoreMax");
  const scoreMin =
    scoreMinRaw === null
      ? ADMIN_EXAMS_MIN_SCORE
      : clampScore(Number(scoreMinRaw));
  const scoreMax =
    scoreMaxRaw === null
      ? ADMIN_EXAMS_MAX_SCORE
      : clampScore(Number(scoreMaxRaw));
  const integrityScoreMinRaw = searchParams.get("integrityScoreMin");
  const integrityScoreMaxRaw = searchParams.get("integrityScoreMax");
  const integrityScoreMin =
    integrityScoreMinRaw === null
      ? ADMIN_EXAMS_MIN_SCORE
      : clampScore(Number(integrityScoreMinRaw));
  const integrityScoreMax =
    integrityScoreMaxRaw === null
      ? ADMIN_EXAMS_MAX_SCORE
      : clampScore(Number(integrityScoreMaxRaw));

  return {
    page: parsePositiveInteger(searchParams.get("page"), ADMIN_EXAMS_DEFAULT_PAGE),
    limit: parsePositiveInteger(searchParams.get("limit"), ADMIN_EXAMS_DEFAULT_LIMIT),
    filters: {
      range: parseRange(searchParams.get("range")),
      customFrom: parseDateInput(searchParams.get("from")),
      customTo: parseDateInput(searchParams.get("to")),
      passStatus: parsePassStatus(searchParams.get("passStatus")),
      scoreMin: Math.min(scoreMin, scoreMax),
      scoreMax: Math.max(scoreMin, scoreMax),
      flaggedOnly: parseBoolean(searchParams.get("flaggedOnly"), false),
      integrityScoreMin: Math.min(integrityScoreMin, integrityScoreMax),
      integrityScoreMax: Math.max(integrityScoreMin, integrityScoreMax),
      cadetNameQuery: parseOptionalQuery(searchParams.get("cadetName")),
      userIdQuery: parseOptionalQuery(searchParams.get("userId")),
      attemptFilter: parseAttemptFilter(searchParams.get("attempt")),
    },
  };
}

export function buildAdminExamsQueryParams(input: AdminExamsQueryState): URLSearchParams {
  const params = new URLSearchParams();

  params.set("page", String(input.page));
  params.set("limit", String(input.limit));
  params.set("range", input.filters.range);
  params.set("passStatus", input.filters.passStatus);
  params.set("scoreMin", String(input.filters.scoreMin));
  params.set("scoreMax", String(input.filters.scoreMax));
  params.set("attempt", input.filters.attemptFilter);
  params.set("flaggedOnly", String(input.filters.flaggedOnly ?? false));
  params.set(
    "integrityScoreMin",
    String(input.filters.integrityScoreMin ?? ADMIN_EXAMS_MIN_SCORE)
  );
  params.set(
    "integrityScoreMax",
    String(input.filters.integrityScoreMax ?? ADMIN_EXAMS_MAX_SCORE)
  );

  if (input.filters.range === "custom") {
    if (input.filters.customFrom) {
      params.set("from", input.filters.customFrom);
    }
    if (input.filters.customTo) {
      params.set("to", input.filters.customTo);
    }
  }

  if (input.filters.cadetNameQuery) {
    params.set("cadetName", input.filters.cadetNameQuery);
  }

  if (input.filters.userIdQuery) {
    params.set("userId", input.filters.userIdQuery);
  }

  return params;
}

export function getAdminExamActiveFilterChips(
  filters: AdminExamFiltersInput
): AdminExamActiveFilterChip[] {
  const chips: AdminExamActiveFilterChip[] = [];

  if (filters.range !== "30d") {
    if (filters.range === "custom") {
      const fromLabel = filters.customFrom ?? "start";
      const toLabel = filters.customTo ?? "end";
      chips.push({
        key: "range",
        label: `Date: ${fromLabel} to ${toLabel}`,
      });
    } else {
      const presetLabel =
        filters.range === "7d"
          ? "Last 7 days"
          : filters.range === "90d"
            ? "Last 90 days"
            : "Last 30 days";
      chips.push({
        key: "range",
        label: `Date: ${presetLabel}`,
      });
    }
  }

  if (filters.passStatus !== "all") {
    chips.push({
      key: "passStatus",
      label: filters.passStatus === "passed" ? "Status: Passed" : "Status: Failed",
    });
  }

  if (
    filters.scoreMin !== ADMIN_EXAMS_MIN_SCORE ||
    filters.scoreMax !== ADMIN_EXAMS_MAX_SCORE
  ) {
    chips.push({
      key: "scoreRange",
      label: `Score: ${filters.scoreMin}% to ${filters.scoreMax}%`,
    });
  }

  if (filters.flaggedOnly) {
    chips.push({
      key: "flaggedOnly",
      label: "Flagged only",
    });
  }

  if (
    filters.integrityScoreMin !== ADMIN_EXAMS_MIN_SCORE ||
    filters.integrityScoreMax !== ADMIN_EXAMS_MAX_SCORE
  ) {
    chips.push({
      key: "integrityScoreRange",
      label: `Integrity: ${filters.integrityScoreMin}% to ${filters.integrityScoreMax}%`,
    });
  }

  if (filters.cadetNameQuery) {
    chips.push({
      key: "cadetNameQuery",
      label: `Cadet: ${filters.cadetNameQuery}`,
    });
  }

  if (filters.userIdQuery) {
    chips.push({
      key: "userIdQuery",
      label: `User ID: ${filters.userIdQuery}`,
    });
  }

  if (filters.attemptFilter !== "all") {
    chips.push({
      key: "attemptFilter",
      label:
        filters.attemptFilter === "first"
          ? "Attempt: 1st attempt"
          : "Attempt: Retakes",
    });
  }

  return chips;
}

export function hasAnyActiveAdminExamFilters(filters: AdminExamFiltersInput): boolean {
  return getAdminExamActiveFilterChips(filters).length > 0;
}
