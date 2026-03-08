import { v } from "convex/values";
import { query } from "../../_generated/server";
import {
  getAuthenticatedUser,
  requireAuthenticatedUser,
} from "../services/auth";

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

    const totalSessions = allSessions.length;
    const completedCount = completedSessions.length;

    let averageScore = 0;
    if (completedCount > 0) {
      const totalScore = completedSessions.reduce(
        (sum, session) => sum + session.score,
        0
      );
      averageScore = totalScore / completedCount;
    }

    const lastPracticed =
      allSessions.length > 0
        ? Math.max(...allSessions.map((session) => session.startedAt))
        : undefined;

    const totalFlagsPracticed = completedSessions.reduce(
      (sum, session) => sum + session.flagIds.length,
      0
    );

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
