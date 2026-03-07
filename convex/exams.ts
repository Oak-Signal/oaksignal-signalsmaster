import { v } from "convex/values";
import { mutation, query, MutationCtx, QueryCtx } from "./_generated/server";
import { Doc } from "./_generated/dataModel";
import {
  buildExamPolicySnapshot,
  estimateExamDurationMinutes,
  OFFICIAL_EXAM_MIN_RULES_VIEW_DURATION_MS,
  OFFICIAL_EXAM_MIN_PRACTICE_SESSIONS,
  SUPPORTED_BROWSERS,
} from "./lib/exam_policy";
import {
  getExamAcknowledgementErrors,
  getExamStartBlockers,
} from "./lib/exam_start_validators";
import { generateExamQuestions, applyExamAttemptToQuestions } from "./lib/exam_generation";
import { generateExamSeed } from "./lib/exam_randomization";
import { ExamAuditEventType, ExamModeStrategy, ExamQuestionMode } from "./lib/exam_types";
import { buildQuestionChecksum } from "./lib/exam_checksum";
import {
  deriveExamSessionToken,
  issueExamSessionToken,
  validateExamSessionToken,
} from "./lib/exam_session_token";

type AuthenticatedCtx = QueryCtx | MutationCtx;
const MIN_OFFICIAL_EXAM_IDLE_TIMEOUT_MS = 60_000;
const DEFAULT_OFFICIAL_EXAM_SUBMISSION_MIN_INTERVAL_MS = 750;
const DEFAULT_OFFICIAL_EXAM_SUBMISSION_WINDOW_MS = 60_000;
const DEFAULT_OFFICIAL_EXAM_SUBMISSION_MAX_PER_WINDOW = 30;

interface ExamStartData {
  totalQuestions: number;
  expectedDurationMinutes: number;
  totalPracticeSessions: number;
  practiceAveragePercent: number;
  latestAttempt: Doc<"examAttempts"> | null;
  hasOfficialAttempt: boolean;
  blockers: string[];
}

interface ExamGenerationSettings {
  modeStrategy: ExamModeStrategy;
  singleMode?: ExamQuestionMode;
}

interface ExamSubmissionRateLimitConfig {
  minIntervalMs: number;
  windowMs: number;
  maxPerWindow: number;
}

function getPositiveIntegerEnv(
  envKey: string,
  fallback: number,
  minimum: number
): number {
  const raw = process.env[envKey]?.trim();
  if (!raw) {
    return fallback;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
    throw new Error(`${envKey} must be an integer.`);
  }

  if (parsed < minimum) {
    throw new Error(`${envKey} must be at least ${minimum}.`);
  }

  return parsed;
}

function getOfficialExamSubmissionRateLimitConfig(): ExamSubmissionRateLimitConfig {
  return {
    minIntervalMs: getPositiveIntegerEnv(
      "OFFICIAL_EXAM_SUBMISSION_MIN_INTERVAL_MS",
      DEFAULT_OFFICIAL_EXAM_SUBMISSION_MIN_INTERVAL_MS,
      100
    ),
    windowMs: getPositiveIntegerEnv(
      "OFFICIAL_EXAM_SUBMISSION_WINDOW_MS",
      DEFAULT_OFFICIAL_EXAM_SUBMISSION_WINDOW_MS,
      1_000
    ),
    maxPerWindow: getPositiveIntegerEnv(
      "OFFICIAL_EXAM_SUBMISSION_MAX_PER_WINDOW",
      DEFAULT_OFFICIAL_EXAM_SUBMISSION_MAX_PER_WINDOW,
      1
    ),
  };
}

function getOfficialExamIdleTimeoutMs(): number | null {
  const raw = process.env.OFFICIAL_EXAM_IDLE_TIMEOUT_MS?.trim();
  if (!raw) {
    return null;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
    throw new Error("OFFICIAL_EXAM_IDLE_TIMEOUT_MS must be an integer number of milliseconds.");
  }

  if (parsed < MIN_OFFICIAL_EXAM_IDLE_TIMEOUT_MS) {
    throw new Error(
      `OFFICIAL_EXAM_IDLE_TIMEOUT_MS must be at least ${MIN_OFFICIAL_EXAM_IDLE_TIMEOUT_MS}.`
    );
  }

  return parsed;
}

async function resolveExamGenerationSettings(ctx: AuthenticatedCtx): Promise<ExamGenerationSettings> {
  const settings = await ctx.db
    .query("examSettings")
    .withIndex("by_updatedAt")
    .order("desc")
    .first();

  if (!settings) {
    return {
      modeStrategy: "alternating",
    };
  }

  return {
    modeStrategy: settings.modeStrategy,
    singleMode: settings.modeStrategy === "single" ? settings.singleMode : undefined,
  };
}

async function assertAdminUser(ctx: MutationCtx): Promise<Doc<"users">> {
  const user = await getAuthenticatedUser(ctx);
  if (!user) {
    throw new Error("Authentication is required.");
  }
  if (user.role !== "admin") {
    throw new Error("Only administrators can change official exam settings.");
  }
  return user;
}

async function insertExamAuditLog(
  ctx: MutationCtx,
  input: {
    examAttemptId: Doc<"examAttempts">["_id"];
    userId: Doc<"users">["_id"];
    eventType: ExamAuditEventType;
    message: string;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  await ctx.db.insert("examAuditLogs", {
    examAttemptId: input.examAttemptId,
    userId: input.userId,
    eventType: input.eventType,
    message: input.message,
    metadataJson: input.metadata ? JSON.stringify(input.metadata) : undefined,
    createdAt: Date.now(),
  });
}

async function rejectExamSubmission(
  ctx: MutationCtx,
  input: {
    examAttemptId: Doc<"examAttempts">["_id"];
    userId: Doc<"users">["_id"];
    questionIndex: number;
    reason: string;
    auditMessage: string;
    throwMessage?: string;
    eventType?: Extract<ExamAuditEventType, "submission_rejected" | "session_token_rejected">;
    metadata?: Record<string, unknown>;
  }
): Promise<never> {
  await insertExamAuditLog(ctx, {
    examAttemptId: input.examAttemptId,
    userId: input.userId,
    eventType: input.eventType ?? "submission_rejected",
    message: input.auditMessage,
    metadata: {
      questionIndex: input.questionIndex,
      reason: input.reason,
      ...input.metadata,
    },
  });

  throw new Error(input.throwMessage ?? input.auditMessage);
}

async function getOwnedAttempt(
  ctx: AuthenticatedCtx,
  userId: Doc<"users">["_id"],
  examAttemptId: Doc<"examAttempts">["_id"]
): Promise<Doc<"examAttempts"> | null> {
  const attempt = await ctx.db.get(examAttemptId);
  if (!attempt || attempt.userId !== userId) {
    return null;
  }
  return attempt;
}

async function getAttemptQuestions(
  ctx: AuthenticatedCtx,
  examAttemptId: Doc<"examAttempts">["_id"]
): Promise<Doc<"examQuestions">[]> {
  return ctx.db
    .query("examQuestions")
    .withIndex("by_attempt", (q) => q.eq("examAttemptId", examAttemptId))
    .collect();
}

function getCurrentQuestionIndex(questions: Doc<"examQuestions">[]): number | null {
  const sorted = [...questions].sort((a, b) => a.questionIndex - b.questionIndex);
  const next = sorted.find((question) => question.userAnswer === null);
  return next ? next.questionIndex : null;
}

function getLastAnsweredAt(questions: Doc<"examQuestions">[]): number | null {
  return questions
    .map((question) => question.answeredAt ?? null)
    .filter((answeredAt): answeredAt is number => answeredAt !== null)
    .sort((a, b) => b - a)[0] ?? null;
}

async function resolveFlagPrompt(
  ctx: AuthenticatedCtx,
  attempt: Doc<"examAttempts">,
  question: Doc<"examQuestions">
): Promise<{ imagePath?: string; meaning?: string }> {
  const flag = await ctx.db.get(question.flagId);
  if (flag) {
    return question.mode === "learn"
      ? { imagePath: flag.imagePath }
      : { meaning: flag.meaning };
  }

  const snapshotFlag = attempt.flagSnapshot?.find((item) => item.flagId === question.flagId);
  if (!snapshotFlag) {
    throw new Error("Unable to resolve question prompt for this exam attempt.");
  }

  return question.mode === "learn"
    ? { imagePath: snapshotFlag.imagePath }
    : { meaning: snapshotFlag.meaning };
}

async function getAuthenticatedUser(ctx: AuthenticatedCtx): Promise<Doc<"users"> | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return null;
  }

  return ctx.db
    .query("users")
    .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
    .unique();
}

async function getExamStartData(
  ctx: AuthenticatedCtx,
  user: Doc<"users">
): Promise<ExamStartData> {
  const allFlags = await ctx.db
    .query("flags")
    .withIndex("by_order")
    .collect();

  const totalQuestions = allFlags.length;
  const expectedDurationMinutes = estimateExamDurationMinutes(totalQuestions);

  const completedPracticeSessions = await ctx.db
    .query("practiceSessions")
    .withIndex("by_user_status", (q) =>
      q.eq("userId", user._id).eq("status", "completed")
    )
    .collect();

  const totalPracticeSessions = completedPracticeSessions.length;
  const practiceAveragePercent =
    totalPracticeSessions > 0
      ? Math.round(
          completedPracticeSessions.reduce((sum, session) => sum + session.score, 0) /
            totalPracticeSessions
        )
      : 0;

  const latestAttempt = await ctx.db
    .query("examAttempts")
    .withIndex("by_user_startedAt", (q) => q.eq("userId", user._id))
    .order("desc")
    .first();

  const hasOfficialAttempt = Boolean(latestAttempt);

  const blockers = getExamStartBlockers({
    userRole: user.role,
    totalQuestions,
    userPracticeSessions: totalPracticeSessions,
    hasOfficialAttempt,
  });

  return {
    totalQuestions,
    expectedDurationMinutes,
    totalPracticeSessions,
    practiceAveragePercent,
    latestAttempt,
    hasOfficialAttempt,
    blockers,
  };
}

export const getExamStartContext = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user) {
      return null;
    }

    const startData = await getExamStartData(ctx, user);
    const examPolicy = buildExamPolicySnapshot(startData.totalQuestions);
    const generationSettings = await resolveExamGenerationSettings(ctx);

    return {
      examPolicy,
      questionModePolicy: generationSettings,
      expectedDurationMinutes: startData.expectedDurationMinutes,
      minimumRulesViewDurationMs: OFFICIAL_EXAM_MIN_RULES_VIEW_DURATION_MS,
      prerequisite: {
        minimumPracticeSessions: OFFICIAL_EXAM_MIN_PRACTICE_SESSIONS,
        userPracticeSessions: startData.totalPracticeSessions,
        userPracticeAveragePercent: startData.practiceAveragePercent,
        met: startData.totalPracticeSessions >= OFFICIAL_EXAM_MIN_PRACTICE_SESSIONS,
      },
      eligibility: {
        canStart: startData.blockers.length === 0,
        blockers: startData.blockers,
      },
      systemRequirements: {
        stableInternetRequired: true,
        recommendedBrowsers: [...SUPPORTED_BROWSERS],
      },
      proctorInfo: null,
      motivationalMessage: "You've prepared well, good luck!",
      attemptSummary: {
        hasOfficialAttempt: startData.hasOfficialAttempt,
        latestAttemptStatus: startData.latestAttempt?.status ?? null,
        latestStartedAt: startData.latestAttempt?.startedAt ?? null,
      },
    };
  },
});

export const getExamGenerationSettings = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user) {
      return null;
    }

    if (user.role !== "admin") {
      return null;
    }

    const generationSettings = await resolveExamGenerationSettings(ctx);
    return generationSettings;
  },
});

export const setExamGenerationSettings = mutation({
  args: {
    modeStrategy: v.union(v.literal("alternating"), v.literal("single")),
    singleMode: v.optional(v.union(v.literal("learn"), v.literal("match"))),
  },
  handler: async (ctx, args) => {
    const adminUser = await assertAdminUser(ctx);

    if (args.modeStrategy === "single" && !args.singleMode) {
      throw new Error("singleMode is required when modeStrategy is set to single.");
    }

    if (args.modeStrategy === "alternating" && args.singleMode !== undefined) {
      throw new Error("singleMode must not be provided when using alternating mode.");
    }

    const now = Date.now();

    const existing = await ctx.db
      .query("examSettings")
      .withIndex("by_updatedAt")
      .order("desc")
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        modeStrategy: args.modeStrategy,
        singleMode: args.modeStrategy === "single" ? args.singleMode : undefined,
        updatedBy: adminUser._id,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("examSettings", {
        modeStrategy: args.modeStrategy,
        singleMode: args.modeStrategy === "single" ? args.singleMode : undefined,
        updatedBy: adminUser._id,
        updatedAt: now,
        createdAt: now,
      });
    }

    return {
      modeStrategy: args.modeStrategy,
      singleMode: args.modeStrategy === "single" ? args.singleMode : undefined,
      updatedAt: now,
    };
  },
});

export const startOfficialExamAttempt = mutation({
  args: {
    rulesAcknowledged: v.boolean(),
    readinessAcknowledged: v.boolean(),
    rulesViewDurationMs: v.number(),
    stableInternetConfirmed: v.boolean(),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    browserFamily: v.optional(v.string()),
    browserVersion: v.optional(v.string()),
    browserSupported: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user) {
      throw new Error("Must be authenticated to start an official exam attempt.");
    }

    const startData = await getExamStartData(ctx, user);
    if (startData.blockers.length > 0) {
      throw new Error(startData.blockers[0]);
    }

    const acknowledgementErrors = getExamAcknowledgementErrors({
      rulesAcknowledged: args.rulesAcknowledged,
      readinessAcknowledged: args.readinessAcknowledged,
      rulesViewDurationMs: args.rulesViewDurationMs,
      minimumRulesViewDurationMs: OFFICIAL_EXAM_MIN_RULES_VIEW_DURATION_MS,
    });

    if (acknowledgementErrors.length > 0) {
      throw new Error(acknowledgementErrors[0]);
    }

    const requestReceivedAt = Date.now();
    const examPolicy = buildExamPolicySnapshot(startData.totalQuestions);
    const generationSettings = await resolveExamGenerationSettings(ctx);
    const allFlags = await ctx.db
      .query("flags")
      .withIndex("by_order")
      .collect();

    if (allFlags.length < 4) {
      throw new Error(
        "Exam is unavailable because at least 4 flags are required for multiple-choice questions."
      );
    }

    const attemptNumber = (startData.latestAttempt?.attemptNumber ?? 0) + 1;
    const seed = generateExamSeed({
      now: requestReceivedAt,
      attemptNumber,
      userId: user._id,
    });

    const generationStartedAt = Date.now();
    let generationRetryCount = 0;
    let generated:
      | ReturnType<typeof generateExamQuestions>
      | null = null;
    let lastGenerationError: string | null = null;

    // Retry once with a slightly modified seed if generation fails.
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        generated = generateExamQuestions(allFlags, {
          modeStrategy: generationSettings.modeStrategy,
          singleMode: generationSettings.singleMode,
          seed: seed + attempt,
          generationVersion: 1,
        });
        generationRetryCount = attempt;
        break;
      } catch (error) {
        lastGenerationError = error instanceof Error ? error.message : "Unknown generation error";
      }
    }

    if (!generated) {
      throw new Error(lastGenerationError ?? "Failed to generate official exam questions.");
    }

    const generationCompletedAt = Date.now();
    const generationTimeMs = generationCompletedAt - generationStartedAt;
    const examStartedAt = generationCompletedAt;

    const examAttemptId = await ctx.db.insert("examAttempts", {
      userId: user._id,
      status: "started",
      attemptNumber,
      rulesAcknowledgedAt: requestReceivedAt,
      readinessAcknowledgedAt: requestReceivedAt,
      rulesViewDurationMs: args.rulesViewDurationMs,
      policySnapshot: examPolicy,
      prerequisiteSnapshot: {
        minimumPracticeSessionsRequired: OFFICIAL_EXAM_MIN_PRACTICE_SESSIONS,
        userPracticeSessions: startData.totalPracticeSessions,
        userPracticeAveragePercent: startData.practiceAveragePercent,
      },
      systemSnapshot: {
        ipAddress: args.ipAddress,
        userAgent: args.userAgent,
        browserFamily: args.browserFamily,
        browserVersion: args.browserVersion,
        browserSupported: args.browserSupported ?? false,
        stableInternetConfirmed: args.stableInternetConfirmed,
      },
      generationSnapshot: {
        ...generated.generationSnapshot,
        generationStartedAt,
        generationCompletedAt,
        generationTimeMs,
        generationRetryCount,
      },
      flagSnapshot: generated.flagSnapshot,
      startedAt: examStartedAt,
      createdAt: examStartedAt,
      updatedAt: examStartedAt,
    });

    const sessionToken = await issueExamSessionToken({
      examAttemptId: examAttemptId,
      userId: user._id,
      issuedAt: examStartedAt,
    });

    await ctx.db.patch(examAttemptId, {
      sessionTokenHash: sessionToken.tokenHash,
      sessionIssuedAt: sessionToken.issuedAt,
      sessionExpiresAt: sessionToken.expiresAt,
      updatedAt: Date.now(),
    });

    await insertExamAuditLog(ctx, {
      examAttemptId,
      userId: user._id,
      eventType: "generation_started",
      message: "Official exam question generation started.",
      metadata: {
        seed: generated.generationSnapshot.seed,
        attemptNumber,
      },
    });

    const questions = applyExamAttemptToQuestions(generated.questions, examAttemptId, user._id);
    for (const question of questions) {
      await ctx.db.insert("examQuestions", {
        ...question,
        createdAt: examStartedAt,
        updatedAt: examStartedAt,
      });
    }

    await insertExamAuditLog(ctx, {
      examAttemptId,
      userId: user._id,
      eventType: "generation_completed",
      message: "Official exam question generation completed.",
      metadata: {
        generationTimeMs,
        questionCount: questions.length,
        retryCount: generationRetryCount,
        examChecksum: generated.generationSnapshot.examChecksum,
      },
    });

    await insertExamAuditLog(ctx, {
      examAttemptId,
      userId: user._id,
      eventType: "session_token_issued",
      message: "Issued exam session token.",
      metadata: {
        issuedAt: sessionToken.issuedAt,
        expiresAt: sessionToken.expiresAt,
      },
    });

    return {
      examAttemptId,
      startedAt: examStartedAt,
      sessionToken: sessionToken.token,
      sessionExpiresAt: sessionToken.expiresAt,
    };
  },
});

export const getAttemptHistory = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user) {
      return null;
    }

    const limit = args.limit ?? 5;
    if (!Number.isInteger(limit) || limit < 1 || limit > 20) {
      throw new Error("Limit must be an integer between 1 and 20");
    }

    const attempts = await ctx.db
      .query("examAttempts")
      .withIndex("by_user_startedAt", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(limit);

    return attempts.map((attempt) => ({
      examAttemptId: attempt._id,
      attemptNumber: attempt.attemptNumber,
      status: attempt.status,
      startedAt: attempt.startedAt,
      completedAt: attempt.completedAt ?? null,
      scorePercent: attempt.result?.scorePercent ?? null,
      passed: attempt.result?.passed ?? null,
    }));
  },
});

export const getAttemptRuntimeProgress = query({
  args: {
    examAttemptId: v.id("examAttempts"),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user) {
      return null;
    }

    const attempt = await getOwnedAttempt(ctx, user._id, args.examAttemptId);
    if (!attempt) {
      return null;
    }

    const questions = await getAttemptQuestions(ctx, args.examAttemptId);
    const totalQuestions = questions.length;
    const answeredCount = questions.filter((question) => question.userAnswer !== null).length;
    const currentQuestionIndex = getCurrentQuestionIndex(questions);
    const remainingCount = Math.max(0, totalQuestions - answeredCount);
    const completionPercent = totalQuestions > 0
      ? Math.round((answeredCount / totalQuestions) * 100)
      : 0;
    const elapsedMs = Math.max(
      0,
      (attempt.completedAt ?? Date.now()) - attempt.startedAt
    );
    const lastAnsweredAt = getLastAnsweredAt(questions);

    return {
      examAttemptId: attempt._id,
      status: attempt.status,
      totalQuestions,
      answeredCount,
      currentQuestionIndex,
      remainingCount,
      completionPercent,
      elapsedMs,
      lastAnsweredAt,
      startedAt: attempt.startedAt,
      completedAt: attempt.completedAt ?? null,
      generationSnapshot: attempt.generationSnapshot ?? null,
    };
  },
});

export const getCurrentAttemptQuestion = query({
  args: {
    examAttemptId: v.id("examAttempts"),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user) {
      return null;
    }

    const attempt = await getOwnedAttempt(ctx, user._id, args.examAttemptId);
    if (!attempt || attempt.status !== "started") {
      return null;
    }

    const questions = await getAttemptQuestions(ctx, args.examAttemptId);
    const nextQuestionIndex = getCurrentQuestionIndex(questions);
    if (nextQuestionIndex === null) {
      return null;
    }

    const question = questions.find((item) => item.questionIndex === nextQuestionIndex);
    if (!question) {
      throw new Error("Current exam question was not found.");
    }

    const prompt = await resolveFlagPrompt(ctx, attempt, question);

    return {
      questionIndex: question.questionIndex,
      flagKey: question.flagKey,
      mode: question.mode,
      options: question.options,
      prompt,
    };
  },
});

export const getAttemptPreload = query({
  args: {
    examAttemptId: v.id("examAttempts"),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user) {
      return null;
    }

    const attempt = await getOwnedAttempt(ctx, user._id, args.examAttemptId);
    if (!attempt || attempt.status !== "started") {
      return null;
    }

    const questions = (await getAttemptQuestions(ctx, args.examAttemptId))
      .sort((a, b) => a.questionIndex - b.questionIndex);
    const currentIndex = getCurrentQuestionIndex(questions);
    if (currentIndex === null) {
      return {
        currentQuestionImages: [] as string[],
        nextQuestionImages: [] as string[],
      };
    }

    const currentQuestion = questions.find((question) => question.questionIndex === currentIndex);
    const nextQuestion = questions.find((question) => question.questionIndex === currentIndex + 1);

    const collectImages = async (
      question: Doc<"examQuestions"> | undefined
    ): Promise<string[]> => {
      if (!question) {
        return [];
      }

      const images = new Set<string>();
      if (question.mode === "learn") {
        const prompt = await resolveFlagPrompt(ctx, attempt, question);
        if (prompt.imagePath) {
          images.add(prompt.imagePath);
        }
      }

      for (const option of question.options) {
        if (option.imagePath) {
          images.add(option.imagePath);
        }
      }
      return [...images];
    };

    return {
      currentQuestionImages: await collectImages(currentQuestion),
      nextQuestionImages: await collectImages(nextQuestion),
    };
  },
});

export const submitExamAnswer = mutation({
  args: {
    examAttemptId: v.id("examAttempts"),
    questionIndex: v.number(),
    selectedAnswer: v.string(),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user) {
      throw new Error("Must be authenticated to submit official exam answers.");
    }

    const attempt = await getOwnedAttempt(ctx, user._id, args.examAttemptId);
    if (!attempt) {
      return rejectExamSubmission(ctx, {
        examAttemptId: args.examAttemptId,
        userId: user._id,
        questionIndex: args.questionIndex,
        reason: "attempt_not_found_or_access_denied",
        auditMessage: "Rejected submission because exam attempt was not found or access was denied.",
        throwMessage: "Exam attempt not found or access denied.",
      });
    }

    if (attempt.status !== "started") {
      return rejectExamSubmission(ctx, {
        examAttemptId: args.examAttemptId,
        userId: user._id,
        questionIndex: args.questionIndex,
        reason: "attempt_not_active",
        auditMessage: "Rejected submission because exam attempt is no longer active.",
        throwMessage: "Exam attempt is no longer active.",
        metadata: {
          attemptStatus: attempt.status,
        },
      });
    }

    const idleTimeoutMs = getOfficialExamIdleTimeoutMs();

    if (attempt.sessionTokenHash && attempt.sessionIssuedAt && attempt.sessionExpiresAt) {
      if (!args.sessionToken) {
        return rejectExamSubmission(ctx, {
          examAttemptId: args.examAttemptId,
          userId: user._id,
          questionIndex: args.questionIndex,
          reason: "missing_session_token",
          eventType: "session_token_rejected",
          auditMessage: "Rejected submission because session token was missing.",
          throwMessage: "Session validation failed. Please refresh the exam session.",
        });
      }

      const tokenValidation = await validateExamSessionToken({
        token: args.sessionToken,
        examAttemptId: args.examAttemptId,
        userId: user._id,
        issuedAt: attempt.sessionIssuedAt,
        expiresAt: attempt.sessionExpiresAt,
        expectedHash: attempt.sessionTokenHash,
      });

      if (!tokenValidation.valid) {
        return rejectExamSubmission(ctx, {
          examAttemptId: args.examAttemptId,
          userId: user._id,
          questionIndex: args.questionIndex,
          reason: tokenValidation.reason ?? "unknown",
          eventType: "session_token_rejected",
          auditMessage: "Rejected submission due to invalid session token.",
          throwMessage: "Session validation failed. Please refresh the exam session.",
        });
      }

      await insertExamAuditLog(ctx, {
        examAttemptId: args.examAttemptId,
        userId: user._id,
        eventType: "session_token_validated",
        message: "Validated session token for submission.",
        metadata: {
          questionIndex: args.questionIndex,
        },
      });
    }

    const questions = await getAttemptQuestions(ctx, args.examAttemptId);
    const requestReceivedAt = Date.now();
    const submissionRateLimit = getOfficialExamSubmissionRateLimitConfig();

    const answeredTimestamps = questions
      .map((question) => question.answeredAt ?? null)
      .filter((answeredAt): answeredAt is number => answeredAt !== null)
      .sort((a, b) => b - a);

    const mostRecentAnsweredAt = answeredTimestamps[0] ?? null;
    if (mostRecentAnsweredAt !== null) {
      const intervalSinceLastSubmissionMs = requestReceivedAt - mostRecentAnsweredAt;
      if (intervalSinceLastSubmissionMs < submissionRateLimit.minIntervalMs) {
        return rejectExamSubmission(ctx, {
          examAttemptId: args.examAttemptId,
          userId: user._id,
          questionIndex: args.questionIndex,
          reason: "rate_limited_min_interval",
          auditMessage: "Rejected submission due to minimum interval rate limit.",
          throwMessage: "Submitting too quickly. Please wait a moment and try again.",
          metadata: {
            intervalSinceLastSubmissionMs,
            minIntervalMs: submissionRateLimit.minIntervalMs,
            lastAnsweredAt: mostRecentAnsweredAt,
          },
        });
      }
    }

    const recentSubmissionCount = answeredTimestamps.filter(
      (answeredAt) => requestReceivedAt - answeredAt <= submissionRateLimit.windowMs
    ).length;

    if (recentSubmissionCount >= submissionRateLimit.maxPerWindow) {
      return rejectExamSubmission(ctx, {
        examAttemptId: args.examAttemptId,
        userId: user._id,
        questionIndex: args.questionIndex,
        reason: "rate_limited_window",
        auditMessage: "Rejected submission due to rolling-window rate limit.",
        throwMessage: "Too many submissions in a short period. Please wait and try again.",
        metadata: {
          recentSubmissionCount,
          windowMs: submissionRateLimit.windowMs,
          maxPerWindow: submissionRateLimit.maxPerWindow,
        },
      });
    }

    if (idleTimeoutMs !== null) {
      const lastActivityAt = getLastAnsweredAt(questions) ?? attempt.startedAt;
      const idleDurationMs = requestReceivedAt - lastActivityAt;
      if (idleDurationMs >= idleTimeoutMs) {
        await ctx.db.patch(attempt._id, {
          status: "abandoned",
          completedAt: requestReceivedAt,
          immutableAt: requestReceivedAt,
          updatedAt: requestReceivedAt,
        });

        await insertExamAuditLog(ctx, {
          examAttemptId: args.examAttemptId,
          userId: user._id,
          eventType: "idle_timeout_triggered",
          message: "Exam attempt ended automatically due to inactivity timeout.",
          metadata: {
            idleTimeoutMs,
            idleDurationMs,
            lastActivityAt,
            questionIndex: args.questionIndex,
          },
        });

        throw new Error("Exam attempt ended due to inactivity. Return to Exam Start.");
      }
    }

    await insertExamAuditLog(ctx, {
      examAttemptId: args.examAttemptId,
      userId: user._id,
      eventType: "submission_received",
      message: "Official exam answer submission received.",
      metadata: {
        questionIndex: args.questionIndex,
      },
    });

    const expectedQuestionIndex = getCurrentQuestionIndex(questions);
    if (expectedQuestionIndex === null) {
      return rejectExamSubmission(ctx, {
        examAttemptId: args.examAttemptId,
        userId: user._id,
        questionIndex: args.questionIndex,
        reason: "attempt_already_completed",
        auditMessage: "Rejected submission because exam has already been completed.",
        throwMessage: "Exam has already been completed.",
      });
    }

    if (args.questionIndex !== expectedQuestionIndex) {
      return rejectExamSubmission(ctx, {
        examAttemptId: args.examAttemptId,
        userId: user._id,
        questionIndex: args.questionIndex,
        reason: "out_of_order_submission",
        auditMessage: "Rejected out-of-order question submission.",
        throwMessage: `Question index mismatch. Expected ${expectedQuestionIndex}, got ${args.questionIndex}.`,
        metadata: {
          expectedQuestionIndex,
          receivedQuestionIndex: args.questionIndex,
        },
      });
    }

    const question = await ctx.db
      .query("examQuestions")
      .withIndex("by_attempt_question", (q) =>
        q.eq("examAttemptId", args.examAttemptId).eq("questionIndex", args.questionIndex)
      )
      .first();

    if (!question) {
      return rejectExamSubmission(ctx, {
        examAttemptId: args.examAttemptId,
        userId: user._id,
        questionIndex: args.questionIndex,
        reason: "question_not_found",
        auditMessage: "Rejected submission because exam question was not found.",
        throwMessage: "Exam question not found.",
      });
    }

    if (question.userAnswer !== null) {
      return rejectExamSubmission(ctx, {
        examAttemptId: args.examAttemptId,
        userId: user._id,
        questionIndex: args.questionIndex,
        reason: "duplicate_submission",
        auditMessage: "Rejected duplicate submission for previously answered question.",
        throwMessage: "This question has already been answered.",
      });
    }

    const optionIds = question.options.map((option) => option.id);
    if (!optionIds.includes(args.selectedAnswer)) {
      return rejectExamSubmission(ctx, {
        examAttemptId: args.examAttemptId,
        userId: user._id,
        questionIndex: args.questionIndex,
        reason: "invalid_option_id",
        auditMessage: "Rejected submission with invalid option id.",
        throwMessage: "Invalid answer option submitted.",
        metadata: {
          selectedAnswer: args.selectedAnswer,
          validOptionIds: optionIds,
        },
      });
    }

    const expectedChecksum = buildQuestionChecksum({
      examAttemptId: "pending",
      questionIndex: question.questionIndex,
      flagKey: question.flagKey,
      mode: question.mode,
      options: question.options,
      correctAnswer: question.correctAnswer,
    });

    if (question.checksum !== expectedChecksum) {
      return rejectExamSubmission(ctx, {
        examAttemptId: args.examAttemptId,
        userId: user._id,
        questionIndex: args.questionIndex,
        reason: "question_checksum_mismatch",
        auditMessage: "Rejected submission due to question checksum mismatch.",
        throwMessage: "Exam question integrity check failed.",
        metadata: {
          expectedChecksum,
          receivedChecksum: question.checksum,
        },
      });
    }

    const submittedAt = Date.now();
    const isCorrect = args.selectedAnswer === question.correctAnswer;

    await ctx.db.patch(question._id, {
      userAnswer: args.selectedAnswer,
      answeredAt: submittedAt,
      isCorrect,
      updatedAt: submittedAt,
    });

    const updatedQuestions = await getAttemptQuestions(ctx, args.examAttemptId);
    const totalQuestions = updatedQuestions.length;
    const answeredCount = updatedQuestions.filter((item) => item.userAnswer !== null).length;
    const correctCount = updatedQuestions.filter((item) => item.isCorrect === true).length;
    const nextQuestionIndex = getCurrentQuestionIndex(updatedQuestions);
    const isExamComplete = nextQuestionIndex === null;

    if (isExamComplete) {
      const scorePercent = totalQuestions > 0
        ? Math.round((correctCount / totalQuestions) * 100)
        : 0;
      const passed = scorePercent >= attempt.policySnapshot.passThresholdPercent;

      await ctx.db.patch(attempt._id, {
        status: "completed",
        completedAt: submittedAt,
        immutableAt: submittedAt,
        result: {
          totalQuestions,
          correctCount,
          scorePercent,
          passed,
        },
        updatedAt: submittedAt,
      });
    } else {
      await ctx.db.patch(attempt._id, {
        updatedAt: submittedAt,
      });
    }

    await insertExamAuditLog(ctx, {
      examAttemptId: args.examAttemptId,
      userId: user._id,
      eventType: "submission_validated",
      message: "Official exam answer accepted and validated.",
      metadata: {
        questionIndex: args.questionIndex,
        isCorrect,
      },
    });

    return {
      questionIndex: args.questionIndex,
      nextQuestionIndex,
      answeredCount,
      totalQuestions,
      isExamComplete,
    };
  },
});

export const getAttemptById = query({
  args: {
    examAttemptId: v.id("examAttempts"),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user) {
      return null;
    }

    const attempt = await ctx.db.get(args.examAttemptId);
    if (!attempt || attempt.userId !== user._id) {
      return null;
    }

    let sessionToken: string | null = null;
    if (attempt.sessionIssuedAt && attempt.sessionExpiresAt && attempt.sessionTokenHash) {
      try {
        const derivedToken = await deriveExamSessionToken({
          examAttemptId: attempt._id,
          userId: user._id,
          issuedAt: attempt.sessionIssuedAt,
          expiresAt: attempt.sessionExpiresAt,
        });

        const validation = await validateExamSessionToken({
          token: derivedToken,
          examAttemptId: attempt._id,
          userId: user._id,
          issuedAt: attempt.sessionIssuedAt,
          expiresAt: attempt.sessionExpiresAt,
          expectedHash: attempt.sessionTokenHash,
        });

        if (validation.valid) {
          sessionToken = derivedToken;
        }
      } catch {
        sessionToken = null;
      }
    }

    return {
      examAttemptId: attempt._id,
      attemptNumber: attempt.attemptNumber,
      status: attempt.status,
      startedAt: attempt.startedAt,
      completedAt: attempt.completedAt ?? null,
      sessionIssuedAt: attempt.sessionIssuedAt ?? null,
      sessionExpiresAt: attempt.sessionExpiresAt ?? null,
      sessionToken,
      rulesAcknowledgedAt: attempt.rulesAcknowledgedAt,
      readinessAcknowledgedAt: attempt.readinessAcknowledgedAt,
      rulesViewDurationMs: attempt.rulesViewDurationMs,
      policySnapshot: attempt.policySnapshot,
      prerequisiteSnapshot: attempt.prerequisiteSnapshot,
      systemSnapshot: attempt.systemSnapshot,
      generationSnapshot: attempt.generationSnapshot ?? null,
      result: attempt.result ?? null,
    };
  },
});

const CLIENT_SECURITY_EVENT_TYPES = [
  "connection_lost",
  "connection_restored",
  "window_blur",
  "window_focus",
  "tab_hidden",
  "tab_visible",
  "fullscreen_entered",
  "fullscreen_exited",
  "back_navigation_blocked",
  "restricted_shortcut_blocked",
  "idle_warning_shown",
  "idle_timeout_triggered",
] as const;

export const logExamClientEvent = mutation({
  args: {
    examAttemptId: v.id("examAttempts"),
    eventType: v.union(
      v.literal("connection_lost"),
      v.literal("connection_restored"),
      v.literal("window_blur"),
      v.literal("window_focus"),
      v.literal("tab_hidden"),
      v.literal("tab_visible"),
      v.literal("fullscreen_entered"),
      v.literal("fullscreen_exited"),
      v.literal("back_navigation_blocked"),
      v.literal("restricted_shortcut_blocked"),
      v.literal("idle_warning_shown"),
      v.literal("idle_timeout_triggered")
    ),
    message: v.string(),
    metadataJson: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user) {
      throw new Error("Authentication is required.");
    }

    const attempt = await getOwnedAttempt(ctx, user._id, args.examAttemptId);
    if (!attempt) {
      throw new Error("Exam attempt not found or access denied.");
    }

    if (attempt.status !== "started") {
      throw new Error("Client security events can only be logged for active exam attempts.");
    }

    if (!CLIENT_SECURITY_EVENT_TYPES.includes(args.eventType)) {
      throw new Error("Unsupported client security event type.");
    }

    let parsedMetadata: Record<string, unknown> | undefined;
    if (args.metadataJson) {
      if (args.metadataJson.length > 4000) {
        throw new Error("metadataJson exceeds maximum length.");
      }

      try {
        const raw = JSON.parse(args.metadataJson) as unknown;
        if (raw && typeof raw === "object" && !Array.isArray(raw)) {
          parsedMetadata = raw as Record<string, unknown>;
        }
      } catch {
        throw new Error("metadataJson must be valid JSON.");
      }
    }

    await insertExamAuditLog(ctx, {
      examAttemptId: attempt._id,
      userId: user._id,
      eventType: args.eventType,
      message: args.message,
      metadata: parsedMetadata,
    });

    return {
      success: true,
      loggedAt: Date.now(),
    };
  },
});

