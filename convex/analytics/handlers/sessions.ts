import { v } from "convex/values";
import { query } from "../../_generated/server";
import { dateRangeCutoff } from "../services/dateRange";
import { getAuthenticatedUser } from "../services/auth";

export const getSessionResults = query({
  args: {
    sessionId: v.id("practiceSessions"),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user) {
      return null;
    }

    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== user._id) {
      return null;
    }

    if (session.status !== "completed" || !session.questions) {
      return null;
    }

    const enrichedQuestions = await Promise.all(
      session.questions.map(async (question) => {
        const flag = await ctx.db.get(question.flagId);
        if (!flag) {
          return null;
        }

        const isCorrect = question.userAnswer === question.correctAnswer;
        const userAnswerOption = question.options.find(
          (option) => option.id === question.userAnswer
        );
        const correctAnswerOption = question.options.find(
          (option) => option.id === question.correctAnswer
        );

        const userAnswerLabel = userAnswerOption
          ? session.mode === "match"
            ? userAnswerOption.value
            : userAnswerOption.label
          : null;

        const correctAnswerLabel = correctAnswerOption
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
          questionType: question.questionType,
        };
      })
    );

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

export const getRecentSessions = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user) {
      return null;
    }

    const limit = args.limit ?? 5;

    const sessions = await ctx.db
      .query("practiceSessions")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", user._id).eq("status", "completed")
      )
      .order("desc")
      .take(limit);

    return sessions.map((session) => ({
      sessionId: session._id,
      mode: session.mode,
      sessionLength: session.sessionLength,
      score: session.score,
      correctCount: session.correctCount,
      totalQuestions: session.questions?.length ?? session.sessionLength,
      startedAt: session.startedAt,
      completedAt: session.completedAt ?? null,
      timeTaken: session.timeTaken ?? null,
    }));
  },
});

export const getPerformanceTrend = query({
  args: {
    dateRange: v.optional(
      v.union(v.literal("7d"), v.literal("30d"), v.literal("all"))
    ),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user) {
      return null;
    }

    const range = args.dateRange ?? "all";
    const cutoff = dateRangeCutoff(range);

    const sessions = await ctx.db
      .query("practiceSessions")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", user._id).eq("status", "completed")
      )
      .order("asc")
      .collect();

    return sessions
      .filter((session) => (cutoff === 0 ? true : (session.completedAt ?? 0) >= cutoff))
      .map((session) => ({
        sessionId: session._id,
        date: session.completedAt ?? session.startedAt,
        score: session.score,
        mode: session.mode,
        sessionLength: session.sessionLength,
      }));
  },
});
