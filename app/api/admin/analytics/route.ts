import { ConvexHttpClient } from "convex/browser";
import type { FunctionReference } from "convex/server";
import { z } from "zod";

import { adminApiErrorResponse, withAdminApiGuard } from "@/lib/api/admin-handler";
import { api } from "@/convex/_generated/api";
import {
  AdminAnalyticsCohortGroupBy,
  AdminAnalyticsRange,
  AdminPerformanceAnalyticsPayload,
} from "@/lib/admin-analytics-types";

const adminPerformanceAnalyticsQuery =
  api.exams.getAdminPerformanceAnalytics as unknown as FunctionReference<"query">;

const DEFAULT_ANALYTICS_CACHE_TTL_MS = 60 * 60 * 1000;
const MAX_ANALYTICS_CACHE_ENTRIES = 100;

function getAnalyticsCacheTtlMs(): number {
  const raw = process.env.ADMIN_ANALYTICS_CACHE_TTL_MS?.trim();
  if (!raw) {
    return DEFAULT_ANALYTICS_CACHE_TTL_MS;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 1_000) {
    return DEFAULT_ANALYTICS_CACHE_TTL_MS;
  }

  return parsed;
}

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
  const ttlSeconds = Math.floor(getAnalyticsCacheTtlMs() / 1000);

  return {
    "Cache-Control": `private, max-age=${ttlSeconds}, stale-while-revalidate=300`,
    "X-Admin-Analytics-Cache": cacheStatus,
  };
}

function setCachedAnalyticsEntry(cacheKey: string, data: AdminPerformanceAnalyticsPayload, now: number): void {
  if (analyticsCache.size >= MAX_ANALYTICS_CACHE_ENTRIES) {
    const oldestKey = analyticsCache.keys().next().value;
    if (oldestKey) {
      analyticsCache.delete(oldestKey);
    }
  }

  analyticsCache.set(cacheKey, {
    data,
    expiresAt: now + getAnalyticsCacheTtlMs(),
  });
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

    const data = (await convex.query(adminPerformanceAnalyticsQuery, {
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

    setCachedAnalyticsEntry(cacheKey, data, now);

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
