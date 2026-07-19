import { Doc } from "../../_generated/dataModel";
import { QueryCtx, MutationCtx } from "../../_generated/server";
import {
  RANKED_DEFAULT_CONFIG_KEY,
  RANKED_DEFAULT_COOLDOWN_MINUTES,
  RANKED_DEFAULT_DAILY_ATTEMPT_LIMIT,
  RANKED_DEFAULT_WEEKLY_ATTEMPT_LIMIT,
} from "../constants";
import {
  getRankedClockHealthConfig,
  getRankedResultSigningConfig,
  getRankedSubmissionRateLimitConfig,
  getRankedTimingAnomalyConfig,
} from "./security_config";

type RankedCtx = QueryCtx | MutationCtx;

export async function getRankedSystemConfig(
  ctx: RankedCtx
): Promise<Doc<"rankedSystemConfig"> | null> {
  return ctx.db
    .query("rankedSystemConfig")
    .withIndex("by_configKey", (q) => q.eq("configKey", RANKED_DEFAULT_CONFIG_KEY))
    .unique();
}

export async function getActiveRankedSeason(
  ctx: RankedCtx
): Promise<Doc<"rankedSeasons"> | null> {
  const candidates = await ctx.db
    .query("rankedSeasons")
    .withIndex("by_status_startsAt", (q) => q.eq("status", "active"))
    .order("desc")
    .take(5);

  const now = Date.now();

  for (const season of candidates) {
    if (season.startsAt > now) {
      continue;
    }

    if (season.endsAt !== undefined && season.endsAt <= now) {
      continue;
    }

    return season;
  }

  return null;
}

export function getResolvedPolicyConfig(config: Doc<"rankedSystemConfig"> | null) {
  return {
    rankedModeEnabled: config?.rankedModeEnabled ?? false,
    requiresPassedExam: config?.requiresPassedExam ?? true,
    cooldownMinutes: config?.cooldownMinutes ?? RANKED_DEFAULT_COOLDOWN_MINUTES,
    dailyAttemptLimit: config?.dailyAttemptLimit ?? RANKED_DEFAULT_DAILY_ATTEMPT_LIMIT,
    weeklyAttemptLimit: config?.weeklyAttemptLimit ?? RANKED_DEFAULT_WEEKLY_ATTEMPT_LIMIT,
  };
}

export function getResolvedSecurityPolicyConfig() {
  return {
    submissionRateLimit: getRankedSubmissionRateLimitConfig(),
    timingAnomaly: getRankedTimingAnomalyConfig(),
    clockHealth: getRankedClockHealthConfig(),
    resultSigning: getRankedResultSigningConfig(),
  };
}
