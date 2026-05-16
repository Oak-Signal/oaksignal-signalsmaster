import { ConvexHttpClient } from "convex/browser";

import { api } from "@/convex/_generated/api";
import { adminApiErrorResponse, withAdminApiGuard } from "@/lib/api/admin-handler";

interface AdminHealthResponse {
  success: true;
  data: {
    status: "healthy" | "degraded";
    apiUptimeSeconds: number;
    apiLatencyMs: number;
    dbStatus: "up" | "down";
    dbLatencyMs: number | null;
    checkedAt: number;
  };
}

function getConvexClient(convexToken: string): ConvexHttpClient | null {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    return null;
  }

  const convex = new ConvexHttpClient(convexUrl);
  convex.setAuth(convexToken);
  return convex;
}

export const GET = withAdminApiGuard(async (_req, { convexToken }) => {
  const requestStartedAt = Date.now();

  const convex = getConvexClient(convexToken);
  if (!convex) {
    return adminApiErrorResponse(
      500,
      "SERVER_MISCONFIGURED",
      "Convex URL is not configured."
    );
  }

  let dbStatus: "up" | "down" = "up";
  let dbLatencyMs: number | null = null;

  const dbProbeStartedAt = Date.now();
  try {
    const probe = await convex.query(api.exams.getAdminSystemConfig, {});
    if (!probe) {
      return adminApiErrorResponse(403, "FORBIDDEN", "Administrator access is required.");
    }

    dbLatencyMs = Date.now() - dbProbeStartedAt;
  } catch {
    dbStatus = "down";
    dbLatencyMs = null;
  }

  const apiLatencyMs = Date.now() - requestStartedAt;
  const response: AdminHealthResponse = {
    success: true,
    data: {
      status: dbStatus === "up" ? "healthy" : "degraded",
      apiUptimeSeconds: Math.max(0, Math.floor(process.uptime())),
      apiLatencyMs,
      dbStatus,
      dbLatencyMs,
      checkedAt: Date.now(),
    },
  };

  return Response.json(response, {
    status: 200,
    headers: {
      "Cache-Control": "private, no-store",
    },
  });
});
