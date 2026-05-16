import { query } from "../../_generated/server";
import { v } from "convex/values";
import { Doc } from "../../_generated/dataModel";

import { getAuthenticatedUser } from "../services/auth";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;
const MIN_SCORE = 0;
const MAX_SCORE = 100;

type AttemptFilter = "first" | "retake";

interface NormalizedAdminExamFilters {
  completedFromMs?: number;
  completedToMs?: number;
  passed?: boolean;
  scoreMin: number;
  scoreMax: number;
  flaggedOnly: boolean;
  integrityScoreMin: number;
  integrityScoreMax: number;
  cadetNameQuery?: string;
  userIdQuery?: string;
  attemptFilter?: AttemptFilter;
}

function normalizePage(value: number | undefined): number {
  if (!value || !Number.isInteger(value) || value < 1) {
    return DEFAULT_PAGE;
  }
  return value;
}

function normalizeLimit(value: number | undefined): number {
  if (!value || !Number.isInteger(value) || value < 1) {
    return DEFAULT_LIMIT;
  }

  return Math.min(value, MAX_LIMIT);
}

function calculateDurationMs(startedAt: number, completedAt: number): number | null {
  if (!Number.isFinite(startedAt) || !Number.isFinite(completedAt)) {
    return null;
  }

  const duration = completedAt - startedAt;
  return duration >= 0 ? duration : null;
}

function clampScore(value: number, fallback: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(Math.max(value, MIN_SCORE), MAX_SCORE);
}

function normalizeQueryText(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeFilters(args: {
  completedFromMs?: number;
  completedToMs?: number;
  passed?: boolean;
  scoreMin?: number;
  scoreMax?: number;
  flaggedOnly?: boolean;
  integrityScoreMin?: number;
  integrityScoreMax?: number;
  cadetNameQuery?: string;
  userIdQuery?: string;
  attemptFilter?: AttemptFilter;
}): NormalizedAdminExamFilters {
  const min = clampScore(args.scoreMin ?? MIN_SCORE, MIN_SCORE);
  const max = clampScore(args.scoreMax ?? MAX_SCORE, MAX_SCORE);
  const scoreMin = Math.min(min, max);
  const scoreMax = Math.max(min, max);

  const completedFromMs =
    typeof args.completedFromMs === "number" && Number.isFinite(args.completedFromMs)
      ? args.completedFromMs
      : undefined;

  const completedToMs =
    typeof args.completedToMs === "number" && Number.isFinite(args.completedToMs)
      ? args.completedToMs
      : undefined;

  const integrityMin = clampScore(args.integrityScoreMin ?? MIN_SCORE, MIN_SCORE);
  const integrityMax = clampScore(args.integrityScoreMax ?? MAX_SCORE, MAX_SCORE);
  const integrityScoreMin = Math.min(integrityMin, integrityMax);
  const integrityScoreMax = Math.max(integrityMin, integrityMax);

  return {
    completedFromMs,
    completedToMs,
    passed: typeof args.passed === "boolean" ? args.passed : undefined,
    scoreMin,
    scoreMax,
    flaggedOnly: args.flaggedOnly === true,
    integrityScoreMin,
    integrityScoreMax,
    cadetNameQuery: normalizeQueryText(args.cadetNameQuery),
    userIdQuery: normalizeQueryText(args.userIdQuery),
    attemptFilter: args.attemptFilter,
  };
}

function matchesFilters(
  result: Doc<"examResults">,
  filters: NormalizedAdminExamFilters
): boolean {
  if (filters.passed !== undefined && result.passed !== filters.passed) {
    return false;
  }

  if (result.scorePercent < filters.scoreMin || result.scorePercent > filters.scoreMax) {
    return false;
  }

  if (filters.flaggedOnly && result.hasIntegrityFlags !== true) {
    return false;
  }

  if (result.integrityScore !== undefined) {
    if (
      result.integrityScore < filters.integrityScoreMin ||
      result.integrityScore > filters.integrityScoreMax
    ) {
      return false;
    }
  } else if (filters.integrityScoreMin > MIN_SCORE || filters.integrityScoreMax < MAX_SCORE) {
    return false;
  }

  if (filters.attemptFilter === "first" && result.attemptNumber !== 1) {
    return false;
  }

  if (filters.attemptFilter === "retake" && result.attemptNumber <= 1) {
    return false;
  }

  if (filters.cadetNameQuery) {
    const cadetName = result.userSnapshot.fullName.trim().toLowerCase();
    if (!cadetName.includes(filters.cadetNameQuery)) {
      return false;
    }
  }

  if (filters.userIdQuery) {
    const userId = result.userId.toString().toLowerCase();
    if (!userId.includes(filters.userIdQuery)) {
      return false;
    }
  }

  return true;
}

export const getAdminRecentExamAttempts = query({
  args: {
    page: v.optional(v.number()),
    limit: v.optional(v.number()),
    completedFromMs: v.optional(v.number()),
    completedToMs: v.optional(v.number()),
    passed: v.optional(v.boolean()),
    scoreMin: v.optional(v.number()),
    scoreMax: v.optional(v.number()),
    flaggedOnly: v.optional(v.boolean()),
    integrityScoreMin: v.optional(v.number()),
    integrityScoreMax: v.optional(v.number()),
    cadetNameQuery: v.optional(v.string()),
    userIdQuery: v.optional(v.string()),
    attemptFilter: v.optional(v.union(v.literal("first"), v.literal("retake"))),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user || user.role !== "admin") {
      return null;
    }

    const requestedPage = normalizePage(args.page);
    const limit = normalizeLimit(args.limit);
    const filters = normalizeFilters({
      completedFromMs: args.completedFromMs,
      completedToMs: args.completedToMs,
      passed: args.passed,
      scoreMin: args.scoreMin,
      scoreMax: args.scoreMax,
      flaggedOnly: args.flaggedOnly,
      integrityScoreMin: args.integrityScoreMin,
      integrityScoreMax: args.integrityScoreMax,
      cadetNameQuery: args.cadetNameQuery,
      userIdQuery: args.userIdQuery,
      attemptFilter: args.attemptFilter,
    });

    const resultsByDate = await ctx.db
      .query("examResults")
      .withIndex("by_completedAt", (q) => {
        if (
          filters.completedFromMs !== undefined &&
          filters.completedToMs !== undefined
        ) {
          return q
            .gte("completedAt", filters.completedFromMs)
            .lte("completedAt", filters.completedToMs);
        }
        if (filters.completedFromMs !== undefined) {
          return q.gte("completedAt", filters.completedFromMs);
        }
        if (filters.completedToMs !== undefined) {
          return q.lte("completedAt", filters.completedToMs);
        }
        return q;
      })
      .order("desc")
      .collect();

    const filteredResults = resultsByDate.filter((result) => matchesFilters(result, filters));
    const totalCount = filteredResults.length;
    const totalPages = totalCount === 0 ? 0 : Math.ceil(totalCount / limit);
    const page =
      totalPages === 0 ? DEFAULT_PAGE : Math.min(requestedPage, totalPages);

    const startIndex = (page - 1) * limit;
    const pageItems = filteredResults.slice(startIndex, startIndex + limit);

    return {
      items: pageItems.map((result) => ({
        examResultId: result._id,
        examAttemptId: result.examAttemptId,
        userId: result.userId,
        attemptNumber: result.attemptNumber,
        cadetName: result.userSnapshot.fullName,
        completedAt: result.completedAt,
        scorePercent: result.scorePercent,
        passed: result.passed,
        durationMs: calculateDurationMs(result.startedAt, result.completedAt),
        hasIntegrityFlags: result.hasIntegrityFlags,
        integrityScore: result.integrityScore,
        integritySeverity: result.integritySeverity,
      })),
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
      },
      generatedAt: Date.now(),
    };
  },
});
