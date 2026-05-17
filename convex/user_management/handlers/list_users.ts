import { query } from "../../_generated/server";
import { v } from "convex/values";

import { Doc } from "../../_generated/dataModel";
import { requireAdminUser } from "../../lib/auth";

type UserRole = "admin" | "cadet";
type UserStatus = "active" | "suspended" | "banned" | "pending_verification";
type PracticeActivityLevel = "none" | "low" | "medium" | "high";
type ExamPassFilter = "passed" | "failed" | "no_attempt";
type RankedParticipationFilter = "participated" | "not_participated";
type SortBy = "name" | "email" | "role" | "createdAt" | "lastActiveAt" | "status";
type SortDirection = "asc" | "desc";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 250;
const ONLINE_WINDOW_MS = 5 * 60 * 1000;

function normalizePage(page: number | undefined): number {
  if (!page || !Number.isInteger(page) || page < 1) {
    return DEFAULT_PAGE;
  }
  return page;
}

function normalizeLimit(limit: number | undefined): number {
  if (!limit || !Number.isInteger(limit) || limit < 1) {
    return DEFAULT_LIMIT;
  }

  return Math.min(limit, MAX_LIMIT);
}

function normalizeText(text: string | undefined): string | undefined {
  if (!text) {
    return undefined;
  }

  const normalized = text.trim().toLowerCase();
  return normalized.length > 0 ? normalized : undefined;
}

function inferStatus(user: Doc<"users">): UserStatus {
  return user.status ?? "active";
}

function inferActivityLevel(completedSessions: number): PracticeActivityLevel {
  if (completedSessions <= 0) {
    return "none";
  }

  if (completedSessions <= 4) {
    return "low";
  }

  if (completedSessions <= 14) {
    return "medium";
  }

  return "high";
}

function inferExamPassFilter(passedCount: number, failedCount: number): ExamPassFilter {
  if (passedCount > 0) {
    return "passed";
  }

  if (failedCount > 0) {
    return "failed";
  }

  return "no_attempt";
}

function compareStrings(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: "base" });
}

function compareNumbers(a: number, b: number): number {
  if (a === b) {
    return 0;
  }

  return a < b ? -1 : 1;
}

export const getAdminUsersList = query({
  args: {
    page: v.optional(v.number()),
    limit: v.optional(v.number()),
    queryText: v.optional(v.string()),
    role: v.optional(v.union(v.literal("admin"), v.literal("cadet"))),
    status: v.optional(
      v.union(
        v.literal("active"),
        v.literal("suspended"),
        v.literal("banned"),
        v.literal("pending_verification")
      )
    ),
    registeredFromMs: v.optional(v.number()),
    registeredToMs: v.optional(v.number()),
    lastActiveFromMs: v.optional(v.number()),
    lastActiveToMs: v.optional(v.number()),
    examPassFilter: v.optional(
      v.union(v.literal("passed"), v.literal("failed"), v.literal("no_attempt"))
    ),
    practiceActivityLevel: v.optional(
      v.union(v.literal("none"), v.literal("low"), v.literal("medium"), v.literal("high"))
    ),
    rankedParticipation: v.optional(
      v.union(v.literal("participated"), v.literal("not_participated"))
    ),
    includeDeleted: v.optional(v.boolean()),
    sortBy: v.optional(
      v.union(
        v.literal("name"),
        v.literal("email"),
        v.literal("role"),
        v.literal("createdAt"),
        v.literal("lastActiveAt"),
        v.literal("status")
      )
    ),
    sortDirection: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
  },
  handler: async (ctx, args) => {
    await requireAdminUser(ctx, "Administrator access is required.");

    const page = normalizePage(args.page);
    const limit = normalizeLimit(args.limit);
    const queryText = normalizeText(args.queryText);
    const includeDeleted = args.includeDeleted === true;
    const sortBy: SortBy = args.sortBy ?? "createdAt";
    const sortDirection: SortDirection = args.sortDirection ?? "desc";

    const registeredFromMs =
      typeof args.registeredFromMs === "number" && Number.isFinite(args.registeredFromMs)
        ? args.registeredFromMs
        : undefined;
    const registeredToMs =
      typeof args.registeredToMs === "number" && Number.isFinite(args.registeredToMs)
        ? args.registeredToMs
        : undefined;
    const lastActiveFromMs =
      typeof args.lastActiveFromMs === "number" && Number.isFinite(args.lastActiveFromMs)
        ? args.lastActiveFromMs
        : undefined;
    const lastActiveToMs =
      typeof args.lastActiveToMs === "number" && Number.isFinite(args.lastActiveToMs)
        ? args.lastActiveToMs
        : undefined;

    const allUsers = includeDeleted
      ? await ctx.db.query("users").withIndex("by_createdAt").order("desc").collect()
      : await ctx.db
          .query("users")
          .withIndex("by_deletedAt", (q) => q.eq("deletedAt", undefined))
          .collect();

    const practiceSessions = await ctx.db.query("practiceSessions").collect();
    const examResults = await ctx.db.query("examResults").collect();
    const rankedEvents = await ctx.db
      .query("userActivityEvents")
      .withIndex("by_eventType_createdAt", (q) => q.eq("eventType", "ranked_run_completed"))
      .collect();

    const practiceCompletedCountByUser = new Map<string, number>();
    for (const session of practiceSessions) {
      if (session.status !== "completed") {
        continue;
      }

      const key = session.userId.toString();
      const nextCount = (practiceCompletedCountByUser.get(key) ?? 0) + 1;
      practiceCompletedCountByUser.set(key, nextCount);
    }

    const examPassedCountByUser = new Map<string, number>();
    const examFailedCountByUser = new Map<string, number>();
    for (const result of examResults) {
      const key = result.userId.toString();
      if (result.passed) {
        examPassedCountByUser.set(key, (examPassedCountByUser.get(key) ?? 0) + 1);
      } else {
        examFailedCountByUser.set(key, (examFailedCountByUser.get(key) ?? 0) + 1);
      }
    }

    const rankedParticipationByUser = new Map<string, number>();
    for (const event of rankedEvents) {
      const key = event.targetUserId.toString();
      rankedParticipationByUser.set(key, (rankedParticipationByUser.get(key) ?? 0) + 1);
    }

    const now = Date.now();

    const enrichedUsers = allUsers.map((user) => {
      const userKey = user._id.toString();
      const completedSessions = practiceCompletedCountByUser.get(userKey) ?? 0;
      const passedExams = examPassedCountByUser.get(userKey) ?? 0;
      const failedExams = examFailedCountByUser.get(userKey) ?? 0;
      const rankedRuns = rankedParticipationByUser.get(userKey) ?? 0;
      const inferredStatus = inferStatus(user);
      const examPassStatus = inferExamPassFilter(passedExams, failedExams);
      const practiceActivityLevel = inferActivityLevel(completedSessions);
      const rankedParticipation: RankedParticipationFilter =
        rankedRuns > 0 ? "participated" : "not_participated";
      const lastActiveAt = user.lastActiveAt ?? user.updatedAt ?? user.createdAt;

      return {
        user,
        inferredStatus,
        examPassStatus,
        practiceActivityLevel,
        rankedParticipation,
        lastActiveAt,
        isOnline: now - lastActiveAt <= ONLINE_WINDOW_MS,
        completedSessions,
        passedExams,
        failedExams,
        rankedRuns,
      };
    });

    const filteredUsers = enrichedUsers.filter((item) => {
      if (args.role && item.user.role !== args.role) {
        return false;
      }

      if (args.status && item.inferredStatus !== args.status) {
        return false;
      }

      if (registeredFromMs !== undefined && item.user.createdAt < registeredFromMs) {
        return false;
      }

      if (registeredToMs !== undefined && item.user.createdAt > registeredToMs) {
        return false;
      }

      if (lastActiveFromMs !== undefined && item.lastActiveAt < lastActiveFromMs) {
        return false;
      }

      if (lastActiveToMs !== undefined && item.lastActiveAt > lastActiveToMs) {
        return false;
      }

      if (args.examPassFilter && item.examPassStatus !== args.examPassFilter) {
        return false;
      }

      if (args.practiceActivityLevel && item.practiceActivityLevel !== args.practiceActivityLevel) {
        return false;
      }

      if (args.rankedParticipation && item.rankedParticipation !== args.rankedParticipation) {
        return false;
      }

      if (queryText) {
        const name = item.user.name?.toLowerCase() ?? "";
        const email = item.user.email.toLowerCase();
        const id = item.user._id.toString().toLowerCase();

        if (!name.includes(queryText) && !email.includes(queryText) && !id.includes(queryText)) {
          return false;
        }
      }

      return true;
    });

    filteredUsers.sort((a, b) => {
      let comparison = 0;

      if (sortBy === "name") {
        comparison = compareStrings(a.user.name ?? "", b.user.name ?? "");
      } else if (sortBy === "email") {
        comparison = compareStrings(a.user.email, b.user.email);
      } else if (sortBy === "role") {
        comparison = compareStrings(a.user.role, b.user.role);
      } else if (sortBy === "lastActiveAt") {
        comparison = compareNumbers(a.lastActiveAt, b.lastActiveAt);
      } else if (sortBy === "status") {
        comparison = compareStrings(a.inferredStatus, b.inferredStatus);
      } else {
        comparison = compareNumbers(a.user.createdAt, b.user.createdAt);
      }

      if (comparison === 0) {
        comparison = compareNumbers(a.user.createdAt, b.user.createdAt);
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });

    const totalCount = filteredUsers.length;
    const totalPages = totalCount === 0 ? 0 : Math.ceil(totalCount / limit);
    const safePage = totalPages === 0 ? DEFAULT_PAGE : Math.min(page, totalPages);
    const offset = (safePage - 1) * limit;

    const items = filteredUsers.slice(offset, offset + limit).map((item) => ({
      userId: item.user._id,
      clerkId: item.user.clerkId,
      name: item.user.name,
      email: item.user.email,
      role: item.user.role as UserRole,
      status: item.inferredStatus,
      avatarUrl: item.user.profileImageUrl,
      createdAt: item.user.createdAt,
      lastActiveAt: item.lastActiveAt,
      isOnline: item.isOnline,
      emailVerifiedAt: item.user.emailVerifiedAt,
      practiceCompletedSessions: item.completedSessions,
      examPassedCount: item.passedExams,
      examFailedCount: item.failedExams,
      rankedRunsCount: item.rankedRuns,
    }));

    return {
      items,
      pagination: {
        page: safePage,
        limit,
        totalCount,
        totalPages,
      },
      filtersApplied: {
        queryText,
        role: args.role,
        status: args.status,
        registeredFromMs,
        registeredToMs,
        lastActiveFromMs,
        lastActiveToMs,
        examPassFilter: args.examPassFilter,
        practiceActivityLevel: args.practiceActivityLevel,
        rankedParticipation: args.rankedParticipation,
        includeDeleted,
        sortBy,
        sortDirection,
      },
      generatedAt: now,
    };
  },
});
