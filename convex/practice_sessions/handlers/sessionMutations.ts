import { v } from "convex/values";
import { mutation } from "../../_generated/server";
import { Question } from "../../lib/types";
import { startTimer } from "../../lib/performance";
import {
  distributeAnswerPositions,
  distributeAnswerPositionsSeeded,
} from "../../lib/randomization";
import {
  generateLearnModeOptions,
  generateMatchModeOptions,
} from "../../lib/distractor_generation";
import { getOwnedSession, requireAuthenticatedUser } from "../services/auth";
import {
  fetchFlagsForGeneration,
  selectRandomFlags,
} from "../services/generation";

export const createPracticeSession = mutation({
  args: {
    mode: v.union(v.literal("learn"), v.literal("match")),
    sessionLength: v.union(
      v.literal(5),
      v.literal(10),
      v.literal(15),
      v.literal(30),
      v.literal("all")
    ),
    randomSeed: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const timer = startTimer();

    const user = await requireAuthenticatedUser(
      ctx,
      "Must be authenticated to create practice session"
    );

    const existingActiveSession = await ctx.db
      .query("practiceSessions")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", user._id).eq("status", "active")
      )
      .first();

    if (existingActiveSession) {
      throw new Error(
        "You already have an active practice session. Please complete or abandon it first."
      );
    }

    const flagIds = await selectRandomFlags(ctx, args.sessionLength);
    if (flagIds.length === 0) {
      throw new Error("No flags available for practice");
    }

    const selectedFlags = await fetchFlagsForGeneration(ctx, flagIds);
    const allFlags = await ctx.db.query("flags").withIndex("by_order").collect();

    if (allFlags.length < 4) {
      throw new Error(
        `Insufficient flags for question generation. Need at least 4 flags, but only ${allFlags.length} available.`
      );
    }

    const answerPositions = args.randomSeed
      ? distributeAnswerPositionsSeeded(selectedFlags.length, args.randomSeed)
      : distributeAnswerPositions(selectedFlags.length);

    const questions: Question[] = [];
    for (let i = 0; i < selectedFlags.length; i++) {
      const targetFlag = selectedFlags[i];
      const correctPosition = answerPositions[i];

      try {
        const { options, correctAnswer } =
          args.mode === "learn"
            ? generateLearnModeOptions(targetFlag, allFlags, correctPosition)
            : generateMatchModeOptions(targetFlag, allFlags, correctPosition);

        questions.push({
          flagId: targetFlag._id,
          questionType: args.mode,
          options,
          correctAnswer,
          userAnswer: null,
        });
      } catch (error) {
        console.error(
          `Error generating question for flag ${targetFlag.key}:`,
          error
        );
        throw new Error(
          "Failed to generate questions. Please try again with a smaller session size."
        );
      }
    }

    const generationTime = timer.elapsed();
    if (generationTime > 2000) {
      console.warn(
        `[Performance Warning] Question generation took ${generationTime}ms (threshold: 2000ms) for ${questions.length} questions`
      );
    } else {
      console.log(
        `[Performance] Generated ${questions.length} questions in ${generationTime}ms`
      );
    }

    const sessionId = await ctx.db.insert("practiceSessions", {
      userId: user._id,
      mode: args.mode,
      sessionLength:
        args.sessionLength === "all" ? flagIds.length : args.sessionLength,
      flagIds,
      currentIndex: 0,
      score: 0,
      correctCount: 0,
      status: "active",
      startedAt: Date.now(),
      questions,
      generationTime,
    });

    return sessionId;
  },
});

export const abandonSession = mutation({
  args: { sessionId: v.id("practiceSessions") },
  handler: async (ctx, args) => {
    const user = await requireAuthenticatedUser(
      ctx,
      "Must be authenticated to abandon session"
    );

    const session = await getOwnedSession(
      ctx,
      user._id,
      args.sessionId,
      "Session not found"
    );

    if (session.status !== "active") {
      throw new Error("Only active sessions can be abandoned");
    }

    await ctx.db.patch(args.sessionId, {
      status: "abandoned",
      completedAt: Date.now(),
    });

    return { success: true };
  },
});

export const updateSessionProgress = mutation({
  args: {
    sessionId: v.id("practiceSessions"),
    currentIndex: v.number(),
    score: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthenticatedUser(
      ctx,
      "Must be authenticated to update session"
    );

    const session = await getOwnedSession(
      ctx,
      user._id,
      args.sessionId,
      "Session not found"
    );

    if (session.status !== "active") {
      throw new Error("Can only update active sessions");
    }

    await ctx.db.patch(args.sessionId, {
      currentIndex: args.currentIndex,
      score: args.score,
    });

    return { success: true };
  },
});

export const completeSession = mutation({
  args: {
    sessionId: v.id("practiceSessions"),
    finalScore: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthenticatedUser(
      ctx,
      "Must be authenticated to complete session"
    );

    const session = await getOwnedSession(
      ctx,
      user._id,
      args.sessionId,
      "Session not found"
    );

    if (session.status !== "active") {
      throw new Error("Can only complete active sessions");
    }

    await ctx.db.patch(args.sessionId, {
      status: "completed",
      score: args.finalScore,
      currentIndex: session.flagIds.length,
      completedAt: Date.now(),
    });

    return { success: true };
  },
});
