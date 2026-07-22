import { mutation } from "../../_generated/server";
import { v } from "convex/values";

import { requireAuthenticatedUser } from "../../lib/auth";
import { RANKED_START_CONFIRMATION_TOKEN, RANKED_STALE_RUN_INACTIVITY_MS } from "../constants";
import { evaluateRankedAttemptPolicy } from "../services/attempt_policy";
import { getRankedEligibility } from "../services/eligibility";
import {
  getActiveRankedSeason,
  getRankedSystemConfig,
  getResolvedPolicyConfig,
} from "../services/runtime";
import { generateExamQuestions } from "../../lib/exam_generation";
import { voidRankedRun } from "./runtime";

export const startRankedRun = mutation({
  args: {
    confirmationToken: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthenticatedUser(ctx, "Authentication is required to start ranked mode.");

    if (args.confirmationToken !== RANKED_START_CONFIRMATION_TOKEN) {
      throw new Error("Ranked run confirmation token is invalid.");
    }

    const [configDoc, season, flags] = await Promise.all([
      getRankedSystemConfig(ctx),
      getActiveRankedSeason(ctx),
      ctx.db.query("flags").collect(),
    ]);

    const resolvedConfig = getResolvedPolicyConfig(configDoc);

    const eligibility = await getRankedEligibility(
      ctx,
      user,
      resolvedConfig,
      season !== null
    );

    if (!eligibility.isEligible) {
      throw new Error(eligibility.reasons.join(" "));
    }

    const attemptPolicy = await evaluateRankedAttemptPolicy(ctx, user._id, {
      cooldownMinutes: resolvedConfig.cooldownMinutes,
      dailyAttemptLimit: resolvedConfig.dailyAttemptLimit,
      weeklyAttemptLimit: resolvedConfig.weeklyAttemptLimit,
    });

    if (!attemptPolicy.canStart) {
      throw new Error(attemptPolicy.reasons.join(" "));
    }

    const now = Date.now();

    const activeAttempt = await ctx.db
      .query("rankedRuns")
      .withIndex("by_user_startedAt", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(10);

    // A run stuck in "started" status past a reasonable inactivity window is treated as
    // disconnected/abandoned and auto-voided here so the cadet is never permanently locked
    // out of retrying ranked mode (FR-008a). Runs still within the window remain a genuine
    // in-progress block.
    let hasInProgressAttempt = false;
    for (const candidate of activeAttempt) {
      if (candidate.status !== "started") {
        continue;
      }

      const lastActivityAt = candidate.lastAnsweredAt ?? candidate.startedAt;
      const idleForMs = now - lastActivityAt;

      if (idleForMs > RANKED_STALE_RUN_INACTIVITY_MS) {
        await voidRankedRun(ctx, {
          run: candidate,
          userId: user._id,
          now,
          reason: "stale_run_auto_voided_on_new_start",
        });
        continue;
      }

      hasInProgressAttempt = true;
    }

    if (hasInProgressAttempt) {
      throw new Error("An active ranked run already exists for this account.");
    }

    if (!season) {
      throw new Error("No active ranked season is available.");
    }

    // Generate questions for all available flags in alternating mode strategy
    const generated = generateExamQuestions(flags, {
      modeStrategy: "alternating",
      seed: now + user._id.charCodeAt(0),
      generationVersion: 1,
    });

    const runId = await ctx.db.insert("rankedRuns", {
      userId: user._id,
      seasonId: season._id,
      status: "started",
      startedAt: now,
      nextExpectedQuestionIndex: 0,
      flagCount: generated.questions.length,
      correctCount: 0,
      accuracyPercent: 0,
      score: 0,
      pointsFromTime: 0,
      pointsFromAccuracy: 0,
      antiCheatStatus: "clear",
      reviewStatus: "none",
      metadataJson: JSON.stringify({
        source: "ranked_entry_modal",
      }),
      createdAt: now,
      updatedAt: now,
    });

    // Bulk insert the generated questions
    for (const question of generated.questions) {
      await ctx.db.insert("rankedQuestions", {
        runId,
        userId: user._id,
        questionIndex: question.questionIndex,
        flagId: question.flagId,
        flagKey: question.flagKey,
        mode: question.mode,
        options: question.options,
        correctAnswer: question.correctAnswer,
        userAnswer: null,
        createdAt: now,
        updatedAt: now,
      });
    }

    return {
      runId,
      seasonId: season._id,
      startedAt: now,
      flagCount: generated.questions.length,
    };
  },
});
