import { ConvexHttpClient } from "convex/browser";

import { api } from "@/convex/_generated/api";
import { adminApiErrorResponse, withAdminApiGuard } from "@/lib/api/admin-handler";

const STATS_CACHE_TTL_MS = 5 * 60 * 1000;

interface AdminStatsPayload {
  totalExamsAdministered: number;
  overallPassRatePercent: number;
  averageScorePercent: number;
  uniqueTestTakers: number;
  generatedAt: number;
}

interface AdminStatsResponse {
  success: true;
  data: AdminStatsPayload;
}

let cachedStats: {
  data: AdminStatsPayload;
  expiresAt: number;
} | null = null;

function responseHeaders(cacheStatus: "hit" | "miss"): HeadersInit {
  return {
    "Cache-Control": "private, max-age=300, stale-while-revalidate=30",
    "X-Admin-Stats-Cache": cacheStatus,
  };
}

export const GET = withAdminApiGuard(async (_req, { convexToken }) => {
  const now = Date.now();

  if (cachedStats && cachedStats.expiresAt > now) {
    const body: AdminStatsResponse = {
      success: true,
      data: cachedStats.data,
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

    const stats = await convex.query(api.exams.getAdminExamOverviewStats, {});
    if (!stats) {
      return adminApiErrorResponse(403, "FORBIDDEN", "Administrator access is required.");
    }

    cachedStats = {
      data: stats,
      expiresAt: now + STATS_CACHE_TTL_MS,
    };

    const body: AdminStatsResponse = {
      success: true,
      data: stats,
    };

    return Response.json(body, {
      status: 200,
      headers: responseHeaders("miss"),
    });
  } catch {
    return adminApiErrorResponse(500, "INTERNAL_ERROR", "Failed to fetch admin statistics.");
  }
});
