import { Id } from "../../_generated/dataModel";
import { QueryCtx, MutationCtx } from "../../_generated/server";

type RankedCtx = QueryCtx | MutationCtx;

interface AttemptPolicyConfig {
  cooldownMinutes: number;
  dailyAttemptLimit?: number;
  weeklyAttemptLimit?: number;
}

export interface RankedAttemptPolicyResult {
  canStart: boolean;
  reasons: string[];
  nextAllowedAt: number | null;
  isInCooldown: boolean;
  attemptsToday: number;
  attemptsThisWeek: number;
  dailyAttemptLimit: number | null;
  weeklyAttemptLimit: number | null;
  dailyRemaining: number | null;
  weeklyRemaining: number | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

export async function evaluateRankedAttemptPolicy(
  ctx: RankedCtx,
  userId: Id<"users">,
  config: AttemptPolicyConfig,
  now = Date.now()
): Promise<RankedAttemptPolicyResult> {
  const recentRuns = await ctx.db
    .query("rankedRuns")
    .withIndex("by_user_startedAt", (q) => q.eq("userId", userId))
    .order("desc")
    .collect();

  const dailyCutoff = now - DAY_MS;
  const weeklyCutoff = now - WEEK_MS;

  const attemptsToday = recentRuns.filter((run) => run.startedAt >= dailyCutoff).length;
  const attemptsThisWeek = recentRuns.filter((run) => run.startedAt >= weeklyCutoff).length;

  const latestRun = recentRuns[0] ?? null;
  const cooldownMs = config.cooldownMinutes * 60 * 1000;
  const nextAllowedAt = latestRun ? latestRun.startedAt + cooldownMs : null;
  const isInCooldown = nextAllowedAt !== null && now < nextAllowedAt;

  const reasons: string[] = [];

  if (isInCooldown) {
    reasons.push("A cooldown period is active before your next ranked attempt.");
  }

  if (
    typeof config.dailyAttemptLimit === "number" &&
    attemptsToday >= config.dailyAttemptLimit
  ) {
    reasons.push("Daily ranked attempt limit reached.");
  }

  if (
    typeof config.weeklyAttemptLimit === "number" &&
    attemptsThisWeek >= config.weeklyAttemptLimit
  ) {
    reasons.push("Weekly ranked attempt limit reached.");
  }

  const dailyRemaining =
    typeof config.dailyAttemptLimit === "number"
      ? Math.max(0, config.dailyAttemptLimit - attemptsToday)
      : null;

  const weeklyRemaining =
    typeof config.weeklyAttemptLimit === "number"
      ? Math.max(0, config.weeklyAttemptLimit - attemptsThisWeek)
      : null;

  return {
    canStart: reasons.length === 0,
    reasons,
    nextAllowedAt,
    isInCooldown,
    attemptsToday,
    attemptsThisWeek,
    dailyAttemptLimit: config.dailyAttemptLimit ?? null,
    weeklyAttemptLimit: config.weeklyAttemptLimit ?? null,
    dailyRemaining,
    weeklyRemaining,
  };
}
