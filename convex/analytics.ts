import { v } from "convex/values";
import { query, QueryCtx } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";

// ---------------------------------------------------------------------------
// Shared Helpers
// ---------------------------------------------------------------------------

/**
 * Resolve the authenticated user document or return null.
 * Used by every query in this file to enforce auth + user lookup in one place.
 */
async function getAuthenticatedUser(
    ctx: QueryCtx
): Promise<Doc<"users"> | null> {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    return ctx.db
        .query("users")
        .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
        .unique();
}

/**
 * Compute the epoch-ms cutoff for a given date range string.
 * Returns 0 for "all" (no cutoff).
 */
function dateRangeCutoff(range: "7d" | "30d" | "all"): number {
    if (range === "all") return 0;
    const days = range === "7d" ? 7 : 30;
    return Date.now() - days * 24 * 60 * 60 * 1000;
}

// ---------------------------------------------------------------------------
// Query: getSessionResults
// ---------------------------------------------------------------------------

/**
 * Returns a completed session along with each question enriched with full
 * flag data. Used by the Results page. Only returns sessions belonging to
 * the authenticated user (IDOR guard).
 */
export const getSessionResults = query({
    args: {
        sessionId: v.id("practiceSessions"),
    },
    handler: async (ctx, args) => {
        const user = await getAuthenticatedUser(ctx);
        if (!user) return null;

        const session = await ctx.db.get(args.sessionId);

        // Security: only return sessions that belong to this user
        if (!session || session.userId !== user._id) return null;

        // Only makes sense to review completed sessions
        if (session.status !== "completed" || !session.questions) return null;

        // Enrich each question with the full flag document
        const enrichedQuestions = await Promise.all(
            session.questions.map(async (q) => {
                const flag = await ctx.db.get(q.flagId);
                if (!flag) return null;

                const isCorrect = q.userAnswer === q.correctAnswer;

                // Resolve human-readable labels from the options array
                const userAnswerOption = q.options.find((o) => o.id === q.userAnswer);
                const correctAnswerOption = q.options.find(
                    (o) => o.id === q.correctAnswer
                );

                const userAnswerLabel =
                    userAnswerOption
                        ? session.mode === "match"
                            ? userAnswerOption.value
                            : userAnswerOption.label
                        : null;

                const correctAnswerLabel =
                    correctAnswerOption
                        ? session.mode === "match"
                            ? correctAnswerOption.value
                            : correctAnswerOption.label
                        : flag.name;

                return {
                    flagId: flag._id,
                    flagKey: flag.key,
                    flagName: flag.name,
                    flagMeaning: flag.meaning,
                    flagImagePath: flag.imagePath,
                    flagCategory: flag.category,
                    flagType: flag.type,
                    isCorrect,
                    userAnswerLabel,
                    correctAnswerLabel,
                    questionType: q.questionType,
                };
            })
        );

        // Filter out any questions where the flag was deleted (edge case)
        const questions = enrichedQuestions.filter(Boolean) as NonNullable<
            (typeof enrichedQuestions)[number]
        >[];

        return {
            sessionId: session._id,
            mode: session.mode,
            sessionLength: session.sessionLength,
            score: session.score,
            correctCount: session.correctCount,
            totalQuestions: session.questions.length,
            startedAt: session.startedAt,
            completedAt: session.completedAt ?? null,
            timeTaken: session.timeTaken ?? null,
            questions,
        };
    },
});

// ---------------------------------------------------------------------------
// Query: getRecentSessions
// ---------------------------------------------------------------------------

/**
 * Returns the N most recent completed sessions for the current user.
 * Used by the Recent Activity widget on the dashboard.
 */
export const getRecentSessions = query({
    args: {
        limit: v.optional(v.number()), // Defaults to 5
    },
    handler: async (ctx, args) => {
        const user = await getAuthenticatedUser(ctx);
        if (!user) return null;

        const limit = args.limit ?? 5;

        const sessions = await ctx.db
            .query("practiceSessions")
            .withIndex("by_user_status", (q) =>
                q.eq("userId", user._id).eq("status", "completed")
            )
            .order("desc")
            .take(limit);

        return sessions.map((s) => ({
            sessionId: s._id,
            mode: s.mode,
            sessionLength: s.sessionLength,
            score: s.score,
            correctCount: s.correctCount,
            totalQuestions: s.questions?.length ?? s.sessionLength,
            startedAt: s.startedAt,
            completedAt: s.completedAt ?? null,
            timeTaken: s.timeTaken ?? null,
        }));
    },
});

// ---------------------------------------------------------------------------
// Query: getPerformanceTrend
// ---------------------------------------------------------------------------

/**
 * Returns an ordered list of completed sessions suitable for a Recharts line
 * chart. Each entry maps to one data point: { date, score, mode }.
 * Filtered by optional date range.
 */
export const getPerformanceTrend = query({
    args: {
        dateRange: v.optional(
            v.union(v.literal("7d"), v.literal("30d"), v.literal("all"))
        ),
    },
    handler: async (ctx, args) => {
        const user = await getAuthenticatedUser(ctx);
        if (!user) return null;

        const range = args.dateRange ?? "all";
        const cutoff = dateRangeCutoff(range);

        const sessions = await ctx.db
            .query("practiceSessions")
            .withIndex("by_user_status", (q) =>
                q.eq("userId", user._id).eq("status", "completed")
            )
            .order("asc") // Oldest first for a left-to-right chart
            .collect();

        return sessions
            .filter((s) => (cutoff === 0 ? true : (s.completedAt ?? 0) >= cutoff))
            .map((s) => ({
                sessionId: s._id,
                date: s.completedAt ?? s.startedAt,
                score: s.score,
                mode: s.mode,
                sessionLength: s.sessionLength,
            }));
    },
});

// ---------------------------------------------------------------------------
// Query: getMostMissedFlags
// ---------------------------------------------------------------------------

/**
 * Tallies incorrect answers across all completed sessions and returns the
 * top N most-missed flags with their miss rate.
 */
export const getMostMissedFlags = query({
    args: {
        limit: v.optional(v.number()), // Defaults to 5
        dateRange: v.optional(
            v.union(v.literal("7d"), v.literal("30d"), v.literal("all"))
        ),
    },
    handler: async (ctx, args) => {
        const user = await getAuthenticatedUser(ctx);
        if (!user) return null;

        const range = args.dateRange ?? "all";
        const cutoff = dateRangeCutoff(range);
        const limit = args.limit ?? 5;

        const sessions = await ctx.db
            .query("practiceSessions")
            .withIndex("by_user_status", (q) =>
                q.eq("userId", user._id).eq("status", "completed")
            )
            .collect();

        // Tally attempts and misses per flagId
        const tally = new Map<
            string,
            { flagId: Id<"flags">; attempts: number; misses: number }
        >();

        for (const session of sessions) {
            if (cutoff > 0 && (session.completedAt ?? 0) < cutoff) continue;
            if (!session.questions) continue;

            for (const q of session.questions) {
                const key = q.flagId.toString();
                const existing = tally.get(key) ?? {
                    flagId: q.flagId,
                    attempts: 0,
                    misses: 0,
                };
                existing.attempts += 1;
                if (q.userAnswer !== q.correctAnswer) existing.misses += 1;
                tally.set(key, existing);
            }
        }

        // Sort by miss rate descending, then by total misses to break ties
        const sorted = Array.from(tally.values())
            .filter((t) => t.misses > 0)
            .sort((a, b) => {
                const rateA = a.misses / a.attempts;
                const rateB = b.misses / b.attempts;
                if (rateB !== rateA) return rateB - rateA;
                return b.misses - a.misses;
            })
            .slice(0, limit);

        // Enrich with flag metadata
        const enriched = await Promise.all(
            sorted.map(async (item) => {
                const flag = await ctx.db.get(item.flagId);
                if (!flag) return null;
                return {
                    flagId: flag._id,
                    flagKey: flag.key,
                    flagName: flag.name,
                    flagImagePath: flag.imagePath,
                    flagCategory: flag.category,
                    attempts: item.attempts,
                    misses: item.misses,
                    missRate: Math.round((item.misses / item.attempts) * 100),
                };
            })
        );

        return enriched.filter(Boolean) as NonNullable<
            (typeof enriched)[number]
        >[];
    },
});

// ---------------------------------------------------------------------------
// Query: getMasteryFlags
// ---------------------------------------------------------------------------

/**
 * Returns flags the user has consistently answered correctly within the
 * selected range. A flag is considered "mastered" when it has at least
 * 2 attempts and 0 misses.
 */
export const getMasteryFlags = query({
    args: {
        limit: v.optional(v.number()),
        dateRange: v.optional(
            v.union(v.literal("7d"), v.literal("30d"), v.literal("all"))
        ),
    },
    handler: async (ctx, args) => {
        const user = await getAuthenticatedUser(ctx);
        if (!user) return null;

        const range = args.dateRange ?? "all";
        const cutoff = dateRangeCutoff(range);
        const limit = args.limit ?? 8;

        const sessions = await ctx.db
            .query("practiceSessions")
            .withIndex("by_user_status", (q) =>
                q.eq("userId", user._id).eq("status", "completed")
            )
            .collect();

        const tally = new Map<
            string,
            { flagId: Id<"flags">; attempts: number; misses: number }
        >();

        for (const session of sessions) {
            if (cutoff > 0 && (session.completedAt ?? 0) < cutoff) continue;
            if (!session.questions) continue;

            for (const q of session.questions) {
                const key = q.flagId.toString();
                const existing = tally.get(key) ?? {
                    flagId: q.flagId,
                    attempts: 0,
                    misses: 0,
                };
                existing.attempts += 1;
                if (q.userAnswer !== q.correctAnswer) existing.misses += 1;
                tally.set(key, existing);
            }
        }

        const mastered = Array.from(tally.values())
            .filter((t) => t.attempts >= 2 && t.misses === 0)
            .sort((a, b) => b.attempts - a.attempts)
            .slice(0, limit);

        const enriched = await Promise.all(
            mastered.map(async (item) => {
                const flag = await ctx.db.get(item.flagId);
                if (!flag) return null;
                return {
                    flagId: flag._id,
                    flagKey: flag.key,
                    flagName: flag.name,
                    flagImagePath: flag.imagePath,
                    flagCategory: flag.category,
                    attempts: item.attempts,
                };
            })
        );

        return enriched.filter(Boolean) as NonNullable<
            (typeof enriched)[number]
        >[];
    },
});

// ---------------------------------------------------------------------------
// Query: getAnalyticsSummary
// ---------------------------------------------------------------------------

/**
 * Aggregates comprehensive stats for the analytics dashboard.
 * All heavy computation is done server-side so the client receives a
 * pre-calculated summary, not raw session arrays.
 */
export const getAnalyticsSummary = query({
    args: {
        dateRange: v.optional(
            v.union(v.literal("7d"), v.literal("30d"), v.literal("all"))
        ),
    },
    handler: async (ctx, args) => {
        const user = await getAuthenticatedUser(ctx);
        if (!user) return null;

        const range = args.dateRange ?? "all";
        const cutoff = dateRangeCutoff(range);

        // Fetch all completed sessions for this user
        const allCompleted = await ctx.db
            .query("practiceSessions")
            .withIndex("by_user_status", (q) =>
                q.eq("userId", user._id).eq("status", "completed")
            )
            .collect();

        // Apply date range filter
        const sessions = allCompleted.filter(
            (s) => cutoff === 0 || (s.completedAt ?? 0) >= cutoff
        );

        const totalSessions = sessions.length;

        if (totalSessions === 0) {
            return {
                totalSessions: 0,
                averageScore: 0,
                bestScore: 0,
                totalTimePracticed: 0,
                avgSessionTime: 0,
                longestStreak: 0,
                currentStreak: 0,
                modeBreakdown: {
                    learn: { sessions: 0, successRate: 0 },
                    match: { sessions: 0, successRate: 0 },
                },
                categoryBreakdown: [] as {
                    category: string;
                    attempts: number;
                    correct: number;
                    successRate: number;
                }[],
                weeklyFrequency: [] as { week: string; count: number }[],
            };
        }

        // --- Basic aggregates ---
        const totalScore = sessions.reduce((sum, s) => sum + s.score, 0);
        const averageScore = Math.round(totalScore / totalSessions);
        const bestScore = Math.max(...sessions.map((s) => s.score));

        const totalTimePracticed = sessions.reduce(
            (sum, s) => sum + (s.timeTaken ?? 0),
            0
        );
        const avgSessionTime = Math.round(totalTimePracticed / totalSessions);

        // --- Mode breakdown ---
        const modeTally: Record<
            "learn" | "match",
            { sessions: number; correct: number; attempts: number }
        > = {
            learn: { sessions: 0, correct: 0, attempts: 0 },
            match: { sessions: 0, correct: 0, attempts: 0 },
        };

        for (const session of sessions) {
            const bucket = modeTally[session.mode];
            bucket.sessions += 1;

            if (session.questions && session.questions.length > 0) {
                bucket.attempts += session.questions.length;
                bucket.correct += session.questions.filter(
                    (q) => q.userAnswer === q.correctAnswer
                ).length;
            } else {
                // Fallback for legacy sessions without question array.
                const attempts = session.sessionLength;
                const correct = Math.round((session.score / 100) * attempts);
                bucket.attempts += attempts;
                bucket.correct += correct;
            }
        }

        const modeBreakdown = {
            learn: {
                sessions: modeTally.learn.sessions,
                successRate:
                    modeTally.learn.attempts > 0
                        ? Math.round(
                              (modeTally.learn.correct / modeTally.learn.attempts) * 100
                          )
                        : 0,
            },
            match: {
                sessions: modeTally.match.sessions,
                successRate:
                    modeTally.match.attempts > 0
                        ? Math.round(
                              (modeTally.match.correct / modeTally.match.attempts) * 100
                          )
                        : 0,
            },
        };

        // --- Streak calculation ---
        // Sort all-time completed sessions by date (most recent first) for streak
        const sortedByDate = [...allCompleted].sort(
            (a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0)
        );

        let longestStreak = 0;
        let currentStreak = 0;

        if (sortedByDate.length > 0) {
            // Group sessions by calendar day (UTC)
            const daySet = new Set<string>();
            for (const s of sortedByDate) {
                const d = new Date(s.completedAt ?? s.startedAt);
                daySet.add(d.toISOString().split("T")[0]);
            }

            // Current streak: consecutive days ending today/yesterday
            const today = new Date();
            today.setUTCHours(0, 0, 0, 0);

            let streak = 0;
            const cursor = new Date(today);
            while (true) {
                const key = cursor.toISOString().split("T")[0];
                if (daySet.has(key)) {
                    streak++;
                    cursor.setUTCDate(cursor.getUTCDate() - 1);
                } else if (streak === 0) {
                    // Allow for yesterday if nothing today yet
                    cursor.setUTCDate(cursor.getUTCDate() - 1);
                    const yKey = cursor.toISOString().split("T")[0];
                    if (daySet.has(yKey)) {
                        streak++;
                        cursor.setUTCDate(cursor.getUTCDate() - 1);
                    } else {
                        break;
                    }
                } else {
                    break;
                }
            }
            currentStreak = streak;

            // Longest ever streak
            const dayList = Array.from(daySet).sort();
            let best = 1;
            let run = 1;
            for (let i = 1; i < dayList.length; i++) {
                const prev = new Date(dayList[i - 1]);
                const curr = new Date(dayList[i]);
                const diff =
                    (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
                if (diff === 1) {
                    run++;
                    best = Math.max(best, run);
                } else {
                    run = 1;
                }
            }
            longestStreak = dayList.length > 0 ? best : 0;
        }

        // --- Category breakdown ---
        // Build per-question category tallies from enriched session data
        const categoryTally = new Map<
            string,
            { attempts: number; correct: number }
        >();

        for (const session of sessions) {
            if (!session.questions) continue;
            for (const q of session.questions) {
                const flag = await ctx.db.get(q.flagId);
                if (!flag) continue;
                const cat = flag.category;
                const existing = categoryTally.get(cat) ?? {
                    attempts: 0,
                    correct: 0,
                };
                existing.attempts += 1;
                if (q.userAnswer === q.correctAnswer) existing.correct += 1;
                categoryTally.set(cat, existing);
            }
        }

        const categoryBreakdown = Array.from(categoryTally.entries()).map(
            ([category, { attempts, correct }]) => ({
                category,
                attempts,
                correct,
                successRate: attempts > 0 ? Math.round((correct / attempts) * 100) : 0,
            })
        );

        // --- Weekly frequency ---
        // Bucket completed sessions by ISO week (YYYY-Www)
        const weekTally = new Map<string, number>();
        for (const s of sessions) {
            const d = new Date(s.completedAt ?? s.startedAt);
            const year = d.getUTCFullYear();
            // ISO week number
            const startOfYear = new Date(Date.UTC(year, 0, 1));
            const dayOfYear =
                Math.floor((d.getTime() - startOfYear.getTime()) / 86400000) + 1;
            const weekNum = Math.ceil(dayOfYear / 7);
            const key = `${year}-W${String(weekNum).padStart(2, "0")}`;
            weekTally.set(key, (weekTally.get(key) ?? 0) + 1);
        }
        const weeklyFrequency = Array.from(weekTally.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([week, count]) => ({ week, count }));

        return {
            totalSessions,
            averageScore,
            bestScore,
            totalTimePracticed,
            avgSessionTime,
            longestStreak,
            currentStreak,
            modeBreakdown,
            categoryBreakdown,
            weeklyFrequency,
        };
    },
});
