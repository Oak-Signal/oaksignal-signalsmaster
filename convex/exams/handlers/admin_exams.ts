import { query } from "../../_generated/server";
import { v } from "convex/values";

import { getAuthenticatedUser } from "../services/auth";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

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

export const getAdminRecentExamAttempts = query({
  args: {
    page: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user || user.role !== "admin") {
      return null;
    }

    const requestedPage = normalizePage(args.page);
    const limit = normalizeLimit(args.limit);

    const allResults = await ctx.db
      .query("examResults")
      .withIndex("by_completedAt")
      .collect();

    const totalCount = allResults.length;
    const totalPages = totalCount === 0 ? 0 : Math.ceil(totalCount / limit);
    const page =
      totalPages === 0 ? DEFAULT_PAGE : Math.min(requestedPage, totalPages);

    const startIndex = (page - 1) * limit;
    const pageWindowSize = startIndex + limit;

    const descWindow = await ctx.db
      .query("examResults")
      .withIndex("by_completedAt")
      .order("desc")
      .take(pageWindowSize);

    const pageItems = descWindow.slice(startIndex, startIndex + limit);

    return {
      items: pageItems.map((result) => ({
        examResultId: result._id,
        examAttemptId: result.examAttemptId,
        cadetName: result.userSnapshot.fullName,
        completedAt: result.completedAt,
        scorePercent: result.scorePercent,
        passed: result.passed,
        durationMs: calculateDurationMs(result.startedAt, result.completedAt),
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
