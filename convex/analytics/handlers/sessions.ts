import { v } from "convex/values";
import { query } from "../../_generated/server";
import { dateRangeCutoff } from "../services/dateRange";
import { getAuthenticatedUser } from "../services/auth";
import { getCompletedSessions } from "../services/sessions";
import { getFlagLookupByIds } from "../services/flagLookup";
import {
  computeAverageResponseTimeMs,
  computeSessionActiveTimeMs,
  deriveSessionCorrectCount,
  deriveSessionScorePercent,
  deriveSessionTotalQuestions,
} from "../../lib/session_stats";

const MISSING_FLAG_NAME = "Unknown flag";

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

    const flagLookup = await getFlagLookupByIds(
      ctx,
      session.questions.map((question) => question.flagId)
    );

    // Every question is returned, even if its flag record was deleted, so the review list length
    // always equals totalQuestions (docs/session-statistics.md#session-total-questions).
    const questions = session.questions.map((question) => {
      const flag = flagLookup.get(question.flagId.toString()) ?? null;

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
        : flag?.name ?? MISSING_FLAG_NAME;

      return {
        flagId: question.flagId,
        flagKey: flag?.key ?? "",
        flagName: flag?.name ?? MISSING_FLAG_NAME,
        flagMeaning: flag?.meaning ?? "",
        flagImagePath: flag?.imagePath ?? "",
        flagCategory: flag?.category ?? "",
        flagType: flag?.type ?? "",
        flagMissing: flag === null,
        isCorrect,
        userAnswerLabel,
        correctAnswerLabel,
        questionType: question.questionType,
      };
    });

    return {
      sessionId: session._id,
      mode: session.mode,
      sessionLength: session.sessionLength,
      score: deriveSessionScorePercent(session),
      correctCount: deriveSessionCorrectCount(session),
      totalQuestions: deriveSessionTotalQuestions(session),
      startedAt: session.startedAt,
      completedAt: session.completedAt ?? null,
      timeTaken: session.timeTaken ?? null,
      activeTimeMs: computeSessionActiveTimeMs(session),
      averageResponseTimeMs: computeAverageResponseTimeMs([session]),
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

    const sessions = await getCompletedSessions(ctx, user._id, "desc", limit);

    return sessions.map((session) => ({
      sessionId: session._id,
      mode: session.mode,
      sessionLength: session.sessionLength,
      score: deriveSessionScorePercent(session),
      correctCount: deriveSessionCorrectCount(session),
      totalQuestions: deriveSessionTotalQuestions(session),
      startedAt: session.startedAt,
      completedAt: session.completedAt ?? null,
      timeTaken: session.timeTaken ?? null,
      activeTimeMs: computeSessionActiveTimeMs(session),
      averageResponseTimeMs: computeAverageResponseTimeMs([session]),
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

    const sessions = await getCompletedSessions(ctx, user._id, "asc");

    return sessions
      .filter((session) => (cutoff === 0 ? true : (session.completedAt ?? 0) >= cutoff))
      .map((session) => ({
        sessionId: session._id,
        date: session.completedAt ?? session.startedAt,
        score: deriveSessionScorePercent(session),
        mode: session.mode,
        sessionLength: session.sessionLength,
      }));
  },
});
