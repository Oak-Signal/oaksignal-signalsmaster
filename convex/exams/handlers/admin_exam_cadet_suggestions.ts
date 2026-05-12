import { query } from "../../_generated/server";
import { v } from "convex/values";

import { getAuthenticatedUser } from "../services/auth";

const DEFAULT_LIMIT = 8;
const MAX_LIMIT = 15;
const MAX_SCAN_RESULTS = 1500;

function normalizeLimit(value: number | undefined): number {
  if (!value || !Number.isInteger(value) || value < 1) {
    return DEFAULT_LIMIT;
  }
  return Math.min(value, MAX_LIMIT);
}

function normalizeQuery(value: string): string {
  return value.trim().toLowerCase();
}

export const getAdminExamCadetSuggestions = query({
  args: {
    query: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user || user.role !== "admin") {
      return null;
    }

    const normalizedQuery = normalizeQuery(args.query);
    if (normalizedQuery.length === 0) {
      return [];
    }

    const limit = normalizeLimit(args.limit);
    const recentResults = await ctx.db
      .query("examResults")
      .withIndex("by_completedAt")
      .order("desc")
      .take(MAX_SCAN_RESULTS);

    const seenUserIds = new Set<string>();
    const suggestions: Array<{ userId: string; cadetName: string }> = [];

    for (const result of recentResults) {
      const cadetName = result.userSnapshot.fullName.trim();
      if (cadetName.length === 0) {
        continue;
      }

      if (!cadetName.toLowerCase().startsWith(normalizedQuery)) {
        continue;
      }

      const userId = result.userId.toString();
      if (seenUserIds.has(userId)) {
        continue;
      }

      seenUserIds.add(userId);
      suggestions.push({
        userId,
        cadetName,
      });

      if (suggestions.length >= limit) {
        break;
      }
    }

    return suggestions;
  },
});
