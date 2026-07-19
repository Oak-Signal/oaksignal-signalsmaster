import { query, mutation } from "../../_generated/server";
import { v } from "convex/values";
import { requireAuthenticatedUser } from "../../lib/auth";

export const getRankedRunState = query({
  args: {
    runId: v.id("rankedRuns"),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthenticatedUser(ctx, "Authentication required to fetch ranked run state.");
    const run = await ctx.db.get(args.runId);

    if (!run || run.userId !== user._id) {
      return null;
    }

    return {
      runId: run._id,
      status: run.status,
      startedAt: run.startedAt,
      completedAt: run.completedAt ?? null,
      runDurationMs: run.runDurationMs ?? null,
      flagCount: run.flagCount,
      correctCount: run.correctCount,
      accuracyPercent: run.accuracyPercent,
      score: run.score,
      pointsFromTime: run.pointsFromTime,
      pointsFromAccuracy: run.pointsFromAccuracy,
      antiCheatStatus: run.antiCheatStatus,
      reviewStatus: run.reviewStatus,
      suspiciousReason: run.suspiciousReason ?? null,
    };
  },
});

export const getRankedRunQuestions = query({
  args: {
    runId: v.id("rankedRuns"),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthenticatedUser(ctx, "Authentication required to fetch ranked run questions.");
    const run = await ctx.db.get(args.runId);

    if (!run || run.userId !== user._id) {
      return null;
    }

    const questions = await ctx.db
      .query("rankedQuestions")
      .withIndex("by_run", (q) => q.eq("runId", args.runId))
      .collect();

    // Sort by question index
    const sortedQuestions = questions.sort((a, b) => a.questionIndex - b.questionIndex);

    // Resolve flag image paths for "learn" mode questions and general rendering
    const resolvedQuestions = [];
    for (const q of sortedQuestions) {
      const flag = await ctx.db.get(q.flagId);
      resolvedQuestions.push({
        questionIndex: q.questionIndex,
        flagId: q.flagId,
        flagKey: q.flagKey,
        mode: q.mode,
        options: q.options,
        userAnswer: q.userAnswer,       // For resuming active runs
        imagePath: flag?.imagePath ?? "",
        meaning: flag?.meaning ?? "",
        name: flag?.name ?? "",
      });
    }

    return resolvedQuestions;
  },
});

export const submitRankedAnswer = mutation({
  args: {
    runId: v.id("rankedRuns"),
    questionIndex: v.number(),
    selectedAnswer: v.string(),
    responseTimeMs: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthenticatedUser(ctx, "Authentication required to submit answer.");
    const run = await ctx.db.get(args.runId);

    if (!run || run.userId !== user._id) {
      throw new Error("Ranked run not found or access denied.");
    }

    if (run.status !== "started") {
      throw new Error("Ranked run is no longer active.");
    }

    const question = await ctx.db
      .query("rankedQuestions")
      .withIndex("by_run_question", (q) => q.eq("runId", args.runId).eq("questionIndex", args.questionIndex))
      .unique();

    if (!question) {
      throw new Error("Question not found.");
    }

    if (question.userAnswer !== null) {
      throw new Error("Question has already been answered.");
    }

    const isCorrect = args.selectedAnswer === question.correctAnswer;
    
    // Scoring logic:
    // Base Accuracy: 1000 points if correct
    // Speed Bonus: up to 3000 points if answered correctly in < 3000ms
    const basePoints = isCorrect ? 1000 : 0;
    const speedBonus = isCorrect && args.responseTimeMs < 3000
      ? Math.max(0, Math.round(3000 - args.responseTimeMs))
      : 0;

    const questionScore = basePoints + speedBonus;

    // Update the question response
    await ctx.db.patch(question._id, {
      userAnswer: args.selectedAnswer,
      answeredAt: Date.now(),
      responseTimeMs: args.responseTimeMs,
      isCorrect: isCorrect,
      updatedAt: Date.now(),
    });

    // Update run aggregates
    const newCorrectCount = run.correctCount + (isCorrect ? 1 : 0);
    const newAccuracyPercent = Math.round((newCorrectCount / run.flagCount) * 100);
    const newScore = run.score + questionScore;
    const newPointsFromTime = run.pointsFromTime + speedBonus;
    const newPointsFromAccuracy = run.pointsFromAccuracy + basePoints;

    await ctx.db.patch(run._id, {
      correctCount: newCorrectCount,
      accuracyPercent: newAccuracyPercent,
      score: newScore,
      pointsFromTime: newPointsFromTime,
      pointsFromAccuracy: newPointsFromAccuracy,
      updatedAt: Date.now(),
    });

    return {
      isCorrect,
      scoreGained: questionScore,
      pointsFromTime: speedBonus,
      pointsFromAccuracy: basePoints,
    };
  },
});

export const completeRankedRun = mutation({
  args: {
    runId: v.id("rankedRuns"),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthenticatedUser(ctx, "Authentication required to complete ranked run.");
    const run = await ctx.db.get(args.runId);

    if (!run || run.userId !== user._id) {
      throw new Error("Ranked run not found or access denied.");
    }

    if (run.status !== "started") {
      throw new Error("Ranked run is not active.");
    }

    const now = Date.now();
    const runDurationMs = now - run.startedAt;

    // Fetch questions to evaluate unanswered or check anti-cheat anomalies
    const questions = await ctx.db
      .query("rankedQuestions")
      .withIndex("by_run", (q) => q.eq("runId", args.runId))
      .collect();

    // Fill in any unanswered questions as incorrect
    const correctCount = run.correctCount;
    for (const q of questions) {
      if (q.userAnswer === null) {
        await ctx.db.patch(q._id, {
          userAnswer: "none",
          answeredAt: now,
          responseTimeMs: 0,
          isCorrect: false,
          updatedAt: now,
        });
      }
    }

    // Recalculate accuracy based on finalized correct count
    const accuracyPercent = Math.round((correctCount / run.flagCount) * 100);

    // Anti-Cheat: Timing Check
    // If the average response time is suspiciously fast (< 350ms per question) OR 
    // any single response time is < 100ms, flag it.
    let antiCheatStatus: "clear" | "flagged" = "clear";
    let suspiciousReason = undefined;

    const avgResponseTimeMs = runDurationMs / run.flagCount;
    const hasSuspectFastAnswer = questions.some(
      (q) => q.responseTimeMs !== undefined && q.responseTimeMs > 0 && q.responseTimeMs < 100
    );

    if (avgResponseTimeMs < 350) {
      antiCheatStatus = "flagged";
      suspiciousReason = `Average response time too fast (${Math.round(avgResponseTimeMs)}ms / question)`;
    } else if (hasSuspectFastAnswer) {
      antiCheatStatus = "flagged";
      suspiciousReason = `Detected answer timing below minimum human threshold (< 100ms)`;
    }

    await ctx.db.patch(run._id, {
      status: "completed",
      completedAt: now,
      runDurationMs,
      accuracyPercent,
      antiCheatStatus,
      suspiciousReason,
      updatedAt: now,
    });

    // Record user activity log event
    await ctx.db.insert("userActivityEvents", {
      targetUserId: user._id,
      eventType: "ranked_run_completed",
      metadataJson: JSON.stringify({
        runId: run._id,
        score: run.score,
        accuracyPercent,
        durationMs: runDurationMs,
        antiCheatStatus,
      }),
      createdAt: now,
    });

    return {
      runId: run._id,
      status: "completed",
      score: run.score,
      accuracyPercent,
      runDurationMs,
      antiCheatStatus,
    };
  },
});

export const abandonRankedRun = mutation({
  args: {
    runId: v.id("rankedRuns"),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthenticatedUser(ctx, "Authentication required to abandon ranked run.");
    const run = await ctx.db.get(args.runId);

    if (!run || run.userId !== user._id) {
      throw new Error("Ranked run not found or access denied.");
    }

    if (run.status !== "started") {
      throw new Error("Ranked run is not active.");
    }

    const now = Date.now();

    await ctx.db.patch(run._id, {
      status: "abandoned",
      completedAt: now,
      updatedAt: now,
    });

    return {
      runId: run._id,
      status: "abandoned",
    };
  },
});
