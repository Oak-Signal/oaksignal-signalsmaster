import { v } from "convex/values";
import { query } from "../../_generated/server";
import {
  getAuthenticatedUser,
  requireAuthenticatedUser,
} from "../services/auth";
import {
  computeAverageScore,
  deriveSessionScorePercent,
} from "../../lib/session_stats";

export const getIncompleteSession = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user) {
      return null;
    }

    const activeSession = await ctx.db
      .query("practiceSessions")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", user._id).eq("status", "active")
      )
      .order("desc")
      .first();

    return activeSession;
  },
});

export const getUserPracticeStats = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user) {
      return null;
    }

    const allSessions = await ctx.db
      .query("practiceSessions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const completedSessions = allSessions.filter((session) => session.status === "completed");

    // "Sessions" always means completed sessions (docs/session-statistics.md#sessions-completed).
    const completedCount = completedSessions.length;
    const totalSessions = completedCount;

    const averageScore = computeAverageScore(
      completedSessions.map(deriveSessionScorePercent)
    );

    // docs/session-statistics.md#last-practiced
    const completionTimes = completedSessions.flatMap((session) =>
      session.completedAt === undefined ? [] : [session.completedAt]
    );
    const lastPracticed =
      completionTimes.length > 0 ? Math.max(...completionTimes) : undefined;

    // Distinct flags across completed sessions (docs/session-statistics.md#flags-practiced).
    const totalFlagsPracticed = new Set(
      completedSessions.flatMap((session) => session.flagIds.map((flagId) => flagId.toString()))
    ).size;

    const modeCount = completedSessions.reduce(
      (acc, session) => {
        acc[session.mode] = (acc[session.mode] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const favoriteMode =
      completedCount > 0
        ? (Object.keys(modeCount).sort((a, b) => modeCount[b] - modeCount[a])[0] as
            | "learn"
            | "match")
        : undefined;

    return {
      totalSessions,
      completedSessions: completedCount,
      averageScore,
      lastPracticed,
      totalFlagsPracticed,
      favoriteMode,
    };
  },
});

export const getSessionById = query({
  args: { sessionId: v.id("practiceSessions") },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user) {
      return null;
    }

    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== user._id) {
      return null;
    }

    return session;
  },
});

export const getCurrentQuestion = query({
  args: { sessionId: v.id("practiceSessions") },
  handler: async (ctx, args) => {
    const user = await requireAuthenticatedUser(
      ctx,
      "Must be authenticated to get question"
    );

    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== user._id) {
      throw new Error("Session not found or access denied");
    }

    if (session.status !== "active") {
      return null;
    }

    if (!session.questions || session.questions.length === 0) {
      throw new Error("Session has no questions. This may be a legacy session.");
    }

    if (session.currentIndex >= session.questions.length) {
      return null;
    }

    const currentQuestion = session.questions[session.currentIndex];
    const flag = await ctx.db.get(currentQuestion.flagId);
    if (!flag) {
      throw new Error("Flag not found for question");
    }

    const answeredQuestions = session.questions.slice(0, session.currentIndex);
    const correctCount = answeredQuestions.filter(
      (question) => question.userAnswer === question.correctAnswer
    ).length;
    const incorrectCount = answeredQuestions.length - correctCount;

    let streak = 0;
    for (let i = session.currentIndex - 1; i >= 0; i--) {
      const question = session.questions[i];
      if (question.userAnswer === question.correctAnswer) {
        streak++;
      } else {
        break;
      }
    }

    const accuracy =
      answeredQuestions.length > 0
        ? Math.round((correctCount / answeredQuestions.length) * 100)
        : 0;

    return {
      question: currentQuestion,
      flag: {
        _id: flag._id,
        key: flag.key,
        type: flag.type,
        name: flag.name,
        meaning: flag.meaning,
        imagePath: flag.imagePath,
        colors: flag.colors,
        description: flag.description,
      },
      questionIndex: session.currentIndex,
      totalQuestions: session.questions.length,
      progress: {
        currentIndex: session.currentIndex,
        totalQuestions: session.questions.length,
        correctCount,
        incorrectCount,
        streak,
        accuracy,
        questionsRemaining: session.questions.length - session.currentIndex,
      },
    };
  },
});
