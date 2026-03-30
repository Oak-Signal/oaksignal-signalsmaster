import { ConvexHttpClient } from "convex/browser";
import { z } from "zod";

import { api } from "@/convex/_generated/api";
import { adminApiErrorResponse, withAdminApiGuard } from "@/lib/api/admin-handler";

const STATS_TIMELINE_CACHE_TTL_MS = 5 * 60 * 1000;

const timelineQuerySchema = z.object({
  range: z.enum(["7d", "30d", "90d"]).default("30d"),
  view: z.enum(["daily", "weekly", "monthly"]).default("daily"),
  timeZone: z.string().trim().min(1).max(100).optional(),
});

interface AdminStatsTimelinePoint {
  periodKey: string;
  label: string;
  rangeLabel: string;
  totalExams: number;
  passedExams: number;
  failedExams: number;
  passRatePercent: number;
  isPeak: boolean;
}

interface AdminStatsTimelinePayload {
  range: "7d" | "30d" | "90d";
  view: "daily" | "weekly" | "monthly";
  timeZone: string;
  points: AdminStatsTimelinePoint[];
  peakTotalExams: number;
  generatedAt: number;
}

interface AdminStatsTimelineResponse {
  success: true;
  data: AdminStatsTimelinePayload;
}

const timelineStatsCache = new Map<
  string,
  {
    data: AdminStatsTimelinePayload;
    expiresAt: number;
  }
>();

function responseHeaders(cacheStatus: "hit" | "miss"): HeadersInit {
  return {
    "Cache-Control": "private, max-age=300, stale-while-revalidate=30",
    "X-Admin-Stats-Timeline-Cache": cacheStatus,
  };
}

function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

function normalizeTimeZone(timeZone?: string): string {
  if (!timeZone) {
    return "UTC";
  }

  return isValidTimeZone(timeZone) ? timeZone : "UTC";
}

export const GET = withAdminApiGuard(async (req, { convexToken }) => {
  const url = new URL(req.url);
  const parsedQuery = timelineQuerySchema.safeParse({
    range: url.searchParams.get("range") ?? undefined,
    view: url.searchParams.get("view") ?? undefined,
    timeZone: url.searchParams.get("timeZone") ?? undefined,
  });

  if (!parsedQuery.success) {
    return adminApiErrorResponse(400, "INVALID_QUERY", "Invalid timeline query parameters.");
  }

  const normalizedTimeZone = normalizeTimeZone(parsedQuery.data.timeZone);
  const cacheKey = `${parsedQuery.data.range}:${parsedQuery.data.view}:${normalizedTimeZone}`;
  const now = Date.now();

  const cached = timelineStatsCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    const body: AdminStatsTimelineResponse = {
      success: true,
      data: cached.data,
    };

    return Response.json(body, {
      status: 200,
      headers: responseHeaders("hit"),
    });
  }

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    return adminApiErrorResponse(
      500,
      "SERVER_MISCONFIGURED",
      "Convex URL is not configured."
    );
  }

  try {
    const convex = new ConvexHttpClient(convexUrl);
    convex.setAuth(convexToken);

    const timeline = await convex.query(api.exams.getAdminExamActivityTimeline, {
      range: parsedQuery.data.range,
      view: parsedQuery.data.view,
      timeZone: normalizedTimeZone,
    });

    if (!timeline) {
      return adminApiErrorResponse(403, "FORBIDDEN", "Administrator access is required.");
    }

    const payload: AdminStatsTimelinePayload = {
      range: timeline.range,
      view: timeline.view,
      timeZone: timeline.timeZone,
      points: timeline.points,
      peakTotalExams: timeline.peakTotalExams,
      generatedAt: timeline.generatedAt,
    };

    timelineStatsCache.set(cacheKey, {
      data: payload,
      expiresAt: now + STATS_TIMELINE_CACHE_TTL_MS,
    });

    const body: AdminStatsTimelineResponse = {
      success: true,
      data: payload,
    };

    return Response.json(body, {
      status: 200,
      headers: responseHeaders("miss"),
    });
  } catch {
    return adminApiErrorResponse(
      500,
      "INTERNAL_ERROR",
      "Failed to fetch admin exam activity timeline."
    );
  }
});
