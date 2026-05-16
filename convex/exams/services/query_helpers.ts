import { Doc } from "../../_generated/dataModel";
import { buildExamPolicySnapshot, estimateExamDurationMinutes, OFFICIAL_EXAM_MIN_PRACTICE_SESSIONS, OFFICIAL_EXAM_MIN_RULES_VIEW_DURATION_MS, SUPPORTED_BROWSERS } from "../../lib/exam_policy";
import { getExamStartBlockers } from "../../lib/exam_start_validators";
import { ExamModeStrategy, ExamQuestionMode } from "../../lib/exam_types";
import { AuthenticatedCtx } from "./auth";
import { getDefaultExamIntegrityThresholdsConfig } from "./config";

const DEFAULT_SYSTEM_CONFIG_KEY = "global";

export interface ResolvedExamSystemConfig {
  configKey: string;
  examEnabled: boolean;
  questionCount: number;
  passThreshold: number;
  availabilityWindow: {
    startDate: string;
    endDate: string;
    startTime: string;
    endTime: string;
    timeZone: string;
  };
  maxRetakes: number;
  retakeCooldownHours: number;
  maintenanceModeEnabled: boolean;
  maintenanceMessage?: string;
}

export interface ExamStartData {
  totalQuestions: number;
  availableFlagsCount: number;
  expectedDurationMinutes: number;
  totalPracticeSessions: number;
  practiceAveragePercent: number;
  latestAttempt: Doc<"examAttempts"> | null;
  latestCompletedAttempt: Doc<"examAttempts"> | null;
  completedOfficialAttempts: number;
  hasOfficialAttempt: boolean;
  systemConfig: ResolvedExamSystemConfig;
  blockers: string[];
}

export interface ExamGenerationSettings {
  modeStrategy: ExamModeStrategy;
  singleMode?: ExamQuestionMode;
}

export interface ExamIntegrityThresholds {
  minAverageAnswerTimeMs: number;
  maxConsecutiveSameAnswer: number;
  minExpectedDurationRatioPercent: number;
  minAnswerTimeStdDevMs: number;
}

export const EXAM_START_CONSTANTS = {
  OFFICIAL_EXAM_MIN_RULES_VIEW_DURATION_MS,
  OFFICIAL_EXAM_MIN_PRACTICE_SESSIONS,
  SUPPORTED_BROWSERS,
} as const;

function parsePositiveInteger(value: number | undefined, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  const normalized = Math.round(value);
  return normalized > 0 ? normalized : fallback;
}

function parseDateInput(value: string | undefined, fallback: string): string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return fallback;
  }
  return value;
}

function parseTimeInput(value: string | undefined, fallback: string): string {
  if (!value || !/^([01]\d|2[0-3]):([0-5]\d)$/.test(value)) {
    return fallback;
  }
  return value;
}

function resolveTimeZone(value: string | undefined): string {
  const candidate = value?.trim();
  if (!candidate) {
    return "UTC";
  }

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: candidate });
    return candidate;
  } catch {
    return "UTC";
  }
}

function getCurrentDateAndTimeInTimeZone(
  nowMs: number,
  timeZone: string
): { dateText: string; timeText: string } {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(new Date(nowMs));
  const lookup = new Map(parts.map((part) => [part.type, part.value]));
  const year = lookup.get("year") ?? "1970";
  const month = lookup.get("month") ?? "01";
  const day = lookup.get("day") ?? "01";
  const hour = lookup.get("hour") ?? "00";
  const minute = lookup.get("minute") ?? "00";

  return {
    dateText: `${year}-${month}-${day}`,
    timeText: `${hour}:${minute}`,
  };
}

function isWithinAvailabilityWindow(
  nowMs: number,
  availabilityWindow: ResolvedExamSystemConfig["availabilityWindow"]
): boolean {
  const nowLocal = getCurrentDateAndTimeInTimeZone(nowMs, availabilityWindow.timeZone);
  if (nowLocal.dateText < availabilityWindow.startDate || nowLocal.dateText > availabilityWindow.endDate) {
    return false;
  }

  if (nowLocal.timeText < availabilityWindow.startTime || nowLocal.timeText > availabilityWindow.endTime) {
    return false;
  }

  return true;
}

export function buildExamPolicy(
  totalQuestions: number,
  passThresholdPercent: number
) {
  return buildExamPolicySnapshot(totalQuestions, {
    passThresholdPercent,
  });
}

export async function resolveExamSystemConfig(
  ctx: AuthenticatedCtx
): Promise<ResolvedExamSystemConfig> {
  const config = await ctx.db
    .query("systemConfig")
    .withIndex("by_configKey", (q) => q.eq("configKey", DEFAULT_SYSTEM_CONFIG_KEY))
    .unique();

  if (!config) {
    return {
      configKey: DEFAULT_SYSTEM_CONFIG_KEY,
      examEnabled: true,
      questionCount: 50,
      passThreshold: 80,
      availabilityWindow: {
        startDate: "2025-01-01",
        endDate: "2025-12-31",
        startTime: "08:00",
        endTime: "20:00",
        timeZone: "UTC",
      },
      maxRetakes: 3,
      retakeCooldownHours: 24,
      maintenanceModeEnabled: false,
      maintenanceMessage: undefined,
    };
  }

  return {
    configKey: config.configKey,
    examEnabled: config.examEnabled,
    questionCount: parsePositiveInteger(config.questionCount, 50),
    passThreshold: Math.min(Math.max(Math.round(config.passThreshold), 1), 100),
    availabilityWindow: {
      startDate: parseDateInput(config.availabilityWindow.startDate, "2025-01-01"),
      endDate: parseDateInput(config.availabilityWindow.endDate, "2025-12-31"),
      startTime: parseTimeInput(config.availabilityWindow.startTime, "08:00"),
      endTime: parseTimeInput(config.availabilityWindow.endTime, "20:00"),
      timeZone: resolveTimeZone(config.availabilityWindow.timeZone),
    },
    maxRetakes: Math.max(Math.round(config.maxRetakes), 0),
    retakeCooldownHours: Math.max(Math.round(config.retakeCooldownHours), 0),
    maintenanceModeEnabled: config.maintenanceModeEnabled,
    maintenanceMessage: config.maintenanceMessage,
  };
}

export async function resolveExamGenerationSettings(
  ctx: AuthenticatedCtx
): Promise<ExamGenerationSettings> {
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

export async function resolveExamIntegrityThresholds(
  ctx: AuthenticatedCtx
): Promise<ExamIntegrityThresholds> {
  const defaults = getDefaultExamIntegrityThresholdsConfig();

  const settings = await ctx.db
    .query("examSettings")
    .withIndex("by_updatedAt")
    .order("desc")
    .first();

  const thresholds = settings?.integrityThresholds;
  if (!thresholds) {
    return defaults;
  }

  const minExpectedDurationRatioPercent = Math.min(
    Math.max(Math.round(thresholds.minExpectedDurationRatioPercent), 1),
    100
  );

  return {
    minAverageAnswerTimeMs: Math.max(Math.round(thresholds.minAverageAnswerTimeMs), 100),
    maxConsecutiveSameAnswer: Math.max(Math.round(thresholds.maxConsecutiveSameAnswer), 2),
    minExpectedDurationRatioPercent,
    minAnswerTimeStdDevMs: Math.max(Math.round(thresholds.minAnswerTimeStdDevMs), 100),
  };
}

export async function getAttemptQuestions(
  ctx: AuthenticatedCtx,
  examAttemptId: Doc<"examAttempts">["_id"]
): Promise<Doc<"examQuestions">[]> {
  return ctx.db
    .query("examQuestions")
    .withIndex("by_attempt", (q) => q.eq("examAttemptId", examAttemptId))
    .collect();
}

export function mapImmutableResultToAttemptResult(result: Doc<"examResults">): {
  totalQuestions: number;
  correctCount: number;
  scorePercent: number;
  passed: boolean;
  modeStats?: {
    learn: { total: number; correct: number; incorrect: number };
    match: { total: number; correct: number; incorrect: number };
  };
  categoryStats?: Array<{ category: string; total: number; correct: number; incorrect: number }>;
} {
  return {
    totalQuestions: result.totalQuestions,
    correctCount: result.totalCorrect,
    scorePercent: result.scorePercent,
    passed: result.passed,
    modeStats: result.modeStats,
    categoryStats: result.categoryStats,
  };
}

export async function getImmutableResultForAttempt(
  ctx: AuthenticatedCtx,
  attempt: Doc<"examAttempts">
): Promise<Doc<"examResults"> | null> {
  if (attempt.examResultId) {
    const linked = await ctx.db.get(attempt.examResultId);
    if (linked) {
      return linked;
    }
  }

  return ctx.db
    .query("examResults")
    .withIndex("by_attempt", (q) => q.eq("examAttemptId", attempt._id))
    .first();
}

export async function resolveFlagPrompt(
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

export async function getExamStartData(
  ctx: AuthenticatedCtx,
  user: Doc<"users">
): Promise<ExamStartData> {
  const nowMs = Date.now();
  const systemConfig = await resolveExamSystemConfig(ctx);

  const allFlags = await ctx.db
    .query("flags")
    .withIndex("by_order")
    .collect();

  const availableFlagsCount = allFlags.length;
  const totalQuestions = Math.min(systemConfig.questionCount, availableFlagsCount);
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

  const completedAttempts = await ctx.db
    .query("examAttempts")
    .withIndex("by_user_status", (q) => q.eq("userId", user._id).eq("status", "completed"))
    .collect();

  const latestCompletedAttempt = completedAttempts
    .filter((attempt) => typeof attempt.completedAt === "number")
    .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0))[0] ?? null;

  const hasOfficialAttempt = Boolean(latestAttempt);

  const withinAvailabilityWindow = isWithinAvailabilityWindow(
    nowMs,
    systemConfig.availabilityWindow
  );

  const blockers = getExamStartBlockers({
    availableFlagsCount,
    configuredQuestionCount: systemConfig.questionCount,
    userPracticeSessions: totalPracticeSessions,
    examEnabled: systemConfig.examEnabled,
    maintenanceModeEnabled: systemConfig.maintenanceModeEnabled,
    maintenanceMessage: systemConfig.maintenanceMessage,
    isWithinAvailabilityWindow: withinAvailabilityWindow,
    maxRetakes: systemConfig.maxRetakes,
    completedOfficialAttempts: completedAttempts.length,
    retakeCooldownHours: systemConfig.retakeCooldownHours,
    latestCompletedAttemptAt: latestCompletedAttempt?.completedAt,
    nowMs,
  });

  return {
    totalQuestions,
    availableFlagsCount,
    expectedDurationMinutes,
    totalPracticeSessions,
    practiceAveragePercent,
    latestAttempt,
    latestCompletedAttempt,
    completedOfficialAttempts: completedAttempts.length,
    hasOfficialAttempt,
    systemConfig,
    blockers,
  };
}
