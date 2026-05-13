import { ConvexHttpClient } from "convex/browser";
import { z } from "zod";

import { adminApiErrorResponse, withAdminApiGuard } from "@/lib/api/admin-handler";
import {
  AdminAnalyticsCohortGroupBy,
  AdminAnalyticsRange,
  AdminPerformanceAnalyticsPayload,
} from "@/lib/admin-analytics-types";

const ANALYTICS_CACHE_TTL_MS = 60 * 60 * 1000;
const ANALYTICS_FUNCTION_NAME = "exams:getAdminPerformanceAnalytics";

const analyticsQuerySchema = z.object({
  range: z.enum(["7d", "30d", "90d"]).default("30d"),
  compareRange: z.enum(["7d", "30d", "90d"]).optional(),
  groupBy: z.enum(["role", "rank"]).default("role"),
  timeZone: z.string().trim().min(1).max(100).optional(),
});

interface AdminAnalyticsSuccessResponse {
  success: true;
  data: AdminPerformanceAnalyticsPayload;
}

const analyticsCache = new Map<
  string,
  {
    data: AdminPerformanceAnalyticsPayload;
    expiresAt: number;
  }
>();

function responseHeaders(cacheStatus: "hit" | "miss"): HeadersInit {
  return {
    "Cache-Control": "private, max-age=3600, stale-while-revalidate=300",
    "X-Admin-Analytics-Cache": cacheStatus,
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
  const parsedQuery = analyticsQuerySchema.safeParse({
    range: url.searchParams.get("range") ?? undefined,
    compareRange: url.searchParams.get("compareRange") ?? undefined,
    groupBy: url.searchParams.get("groupBy") ?? undefined,
    timeZone: url.searchParams.get("timeZone") ?? undefined,
  });

  if (!parsedQuery.success) {
    return adminApiErrorResponse(
      400,
      "INVALID_QUERY",
      "Invalid analytics query parameters."
    );
  }

  const normalizedTimeZone = normalizeTimeZone(parsedQuery.data.timeZone);
  const range = parsedQuery.data.range as AdminAnalyticsRange;
  const compareRange =
    (parsedQuery.data.compareRange as AdminAnalyticsRange | undefined) ?? range;
  const groupBy = parsedQuery.data.groupBy as AdminAnalyticsCohortGroupBy;

  const cacheKey = `${range}:${compareRange}:${groupBy}:${normalizedTimeZone}`;
  const now = Date.now();
  const cached = analyticsCache.get(cacheKey);

  if (cached && cached.expiresAt > now) {
    const body: AdminAnalyticsSuccessResponse = {
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

    const data = (await convex.query(ANALYTICS_FUNCTION_NAME, {
      range,
      compareRange,
      groupBy,
      timeZone: normalizedTimeZone,
    })) as AdminPerformanceAnalyticsPayload | null;

    if (!data) {
      return adminApiErrorResponse(
        403,
        "FORBIDDEN",
        "Administrator access is required."
      );
    }

    analyticsCache.set(cacheKey, {
      data,
      expiresAt: now + ANALYTICS_CACHE_TTL_MS,
    });

    const body: AdminAnalyticsSuccessResponse = {
      success: true,
      data,
    };

    return Response.json(body, {
      status: 200,
      headers: responseHeaders("miss"),
    });
  } catch {
    return adminApiErrorResponse(
      500,
      "INTERNAL_ERROR",
      "Failed to fetch admin analytics."
    );
  }
});
