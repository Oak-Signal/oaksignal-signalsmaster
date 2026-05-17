import { query } from "../../_generated/server";
import { v } from "convex/values";

import { requireAdminUser } from "../../lib/auth";

function calculateAverage(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  const sum = values.reduce((acc, current) => acc + current, 0);
  return sum / values.length;
}

function getMostRecentTimestamp(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  return Math.max(...values);
}

export const getAdminUserProfile = query({
  args: {
    userId: v.id("users"),
    timelineLimit: v.optional(v.number()),
    historyLimit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdminUser(ctx, "Administrator access is required.");

    const timelineLimit =
      typeof args.timelineLimit === "number" && Number.isInteger(args.timelineLimit) && args.timelineLimit > 0
        ? Math.min(args.timelineLimit, 100)
        : 30;

    const historyLimit =
      typeof args.historyLimit === "number" && Number.isInteger(args.historyLimit) && args.historyLimit > 0
        ? Math.min(args.historyLimit, 100)
        : 25;

    const user = await ctx.db.get(args.userId);
    if (!user) {
      return null;
    }

    const practiceSessions = await ctx.db
      .query("practiceSessions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const completedPracticeSessions = practiceSessions.filter(
      (session) => session.status === "completed"
    );

    const practiceScores = completedPracticeSessions.map((session) => session.score);
    const practiceAverageScore = calculateAverage(practiceScores);
    const totalPracticeTimeMs = completedPracticeSessions.reduce((sum, session) => {
      return sum + (session.timeTaken ?? 0);
    }, 0);

    const examAttempts = await ctx.db
      .query("examAttempts")
      .withIndex("by_user_startedAt", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(historyLimit);

    const examResults = await ctx.db
      .query("examResults")
      .withIndex("by_user_completedAt", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();

    const examScores = examResults.map((result) => result.scorePercent);
    const bestExamScore = examScores.length > 0 ? Math.max(...examScores) : null;
    const examPassCount = examResults.filter((result) => result.passed).length;

    const totalExamTimeMs = examResults.reduce((sum, result) => {
      const duration = result.completedAt - result.startedAt;
      return sum + (duration > 0 ? duration : 0);
    }, 0);

    const rankedEvents = await ctx.db
      .query("userActivityEvents")
      .withIndex("by_target_createdAt", (q) => q.eq("targetUserId", args.userId))
      .order("desc")
      .take(500);

    const rankedRuns = rankedEvents.filter((event) => event.eventType === "ranked_run_completed");
    const rankedBestScore = rankedRuns.reduce((best, event) => {
      if (!event.metadataJson) {
        return best;
      }

      try {
        const metadata = JSON.parse(event.metadataJson) as { score?: number };
        if (typeof metadata.score !== "number" || !Number.isFinite(metadata.score)) {
          return best;
        }

        return metadata.score > best ? metadata.score : best;
      } catch {
        return best;
      }
    }, 0);

    const allActivityTimestamps = [
      ...practiceSessions.map((session) => session.startedAt),
      ...examAttempts.map((attempt) => attempt.startedAt),
      ...rankedEvents.map((event) => event.createdAt),
    ];

    const mostRecentActivityAt = getMostRecentTimestamp(allActivityTimestamps);

    const distinctFlagsMastered = new Set<string>();
    for (const session of completedPracticeSessions) {
      if (session.score < 80) {
        continue;
      }

      for (const flagId of session.flagIds) {
        distinctFlagsMastered.add(flagId.toString());
      }
    }

    const categoryStats = new Map<string, { total: number; incorrect: number }>();
    for (const result of examResults) {
      const stats = result.categoryStats ?? [];
      for (const stat of stats) {
        const previous = categoryStats.get(stat.category) ?? { total: 0, incorrect: 0 };
        categoryStats.set(stat.category, {
          total: previous.total + stat.total,
          incorrect: previous.incorrect + stat.incorrect,
        });
      }
    }

    const weakAreas = [...categoryStats.entries()]
      .map(([category, values]) => ({
        category,
        incorrectRatePercent:
          values.total > 0 ? Math.round((values.incorrect / values.total) * 100) : 0,
      }))
      .filter((entry) => entry.incorrectRatePercent > 0)
      .sort((a, b) => b.incorrectRatePercent - a.incorrectRatePercent)
      .slice(0, 5);

    const roleHistory = await ctx.db
      .query("userRoleChangeLogs")
      .withIndex("by_target_createdAt", (q) => q.eq("targetUserId", args.userId))
      .order("desc")
      .take(historyLimit);

    const suspensionHistory = await ctx.db
      .query("userStatusHistory")
      .withIndex("by_target_createdAt", (q) => q.eq("targetUserId", args.userId))
      .order("desc")
      .take(historyLimit);

    const adminNotes = await ctx.db
      .query("userAdminNotes")
      .withIndex("by_target_createdAt", (q) => q.eq("targetUserId", args.userId))
      .order("desc")
      .take(historyLimit);

    const loginHistory = await ctx.db
      .query("userLoginEvents")
      .withIndex("by_target_createdAt", (q) => q.eq("targetUserId", args.userId))
      .order("desc")
      .take(historyLimit);

    const activityTimeline = await ctx.db
      .query("userActivityEvents")
      .withIndex("by_target_createdAt", (q) => q.eq("targetUserId", args.userId))
      .order("desc")
      .take(timelineLimit);

    const practiceActivityDays = new Set(
      completedPracticeSessions.map((session) => new Date(session.startedAt).toISOString().slice(0, 10))
    );

    const frequencyPerWeek =
      practiceActivityDays.size > 0 && user.createdAt > 0
        ? Number(
            (
              (completedPracticeSessions.length /
                Math.max((Date.now() - user.createdAt) / (7 * 24 * 60 * 60 * 1000), 1))
            ).toFixed(2)
          )
        : 0;

    const orderedActivityDays = [...practiceActivityDays].sort().reverse();
    let streakDays = 0;
    let cursor = new Date();
    cursor.setHours(0, 0, 0, 0);

    for (const day of orderedActivityDays) {
      const cursorDate = cursor.toISOString().slice(0, 10);
      if (day !== cursorDate) {
        const previousDate = new Date(cursor.getTime() - 24 * 60 * 60 * 1000)
          .toISOString()
          .slice(0, 10);
        if (day !== previousDate) {
          break;
        }
        cursor = new Date(cursor.getTime() - 24 * 60 * 60 * 1000);
      }

      streakDays += 1;
      cursor = new Date(cursor.getTime() - 24 * 60 * 60 * 1000);
    }

    return {
      profile: {
        userId: user._id,
        clerkId: user.clerkId,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status ?? "active",
        avatarUrl: user.profileImageUrl,
        phone: user.phone,
        contactEmail: user.contactEmail,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        emailVerifiedAt: user.emailVerifiedAt,
        lastLoginAt: user.lastLoginAt,
        lastActiveAt: user.lastActiveAt ?? mostRecentActivityAt ?? user.updatedAt,
        isFlaggedForReview: user.isFlaggedForReview ?? false,
        flaggedForReviewReason: user.flaggedForReviewReason,
      },
      activitySummary: {
        totalPracticeSessions: practiceSessions.length,
        completedPracticeSessions: completedPracticeSessions.length,
        practiceAverageScore,
        examAttemptsCount: examAttempts.length,
        examResultsCount: examResults.length,
        examPassCount,
        examBestScore: bestExamScore,
        rankedRunsCount: rankedRuns.length,
        rankedBestScore: rankedRuns.length > 0 ? rankedBestScore : null,
        totalTimeSpentMs: totalPracticeTimeMs + totalExamTimeMs,
      },
      progress: {
        flagsMasteredCount: distinctFlagsMastered.size,
        weakAreas,
        learningStreakDays: streakDays,
        sessionFrequencyPerWeek: frequencyPerWeek,
      },
      history: {
        roleChanges: roleHistory,
        statusChanges: suspensionHistory,
        adminNotes,
        passwordResetRequests: [],
        emailChangeHistory: [],
      },
      activityMonitoring: {
        activityTimeline,
        loginHistory,
        sessionHistory: practiceSessions
          .slice()
          .sort((a, b) => b.startedAt - a.startedAt)
          .slice(0, historyLimit),
        examAttempts,
        rankedRuns: rankedRuns.slice(0, historyLimit),
      },
      generatedAt: Date.now(),
    };
  },
});
