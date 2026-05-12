import { ConvexHttpClient } from "convex/browser";
import { z } from "zod";

import { api } from "@/convex/_generated/api";
import {
  ADMIN_EXAMS_MAX_SCORE,
  ADMIN_EXAMS_MIN_SCORE,
  ADMIN_EXAMS_DEFAULT_LIMIT,
  ADMIN_EXAMS_DEFAULT_PAGE,
  ADMIN_EXAMS_MAX_LIMIT,
  AdminExamAttemptFilter,
  AdminExamDateRange,
  AdminExamPassStatus,
  AdminRecentExamAttemptsPayload,
} from "@/lib/admin-exams-types";
import { adminApiErrorResponse, withAdminApiGuard } from "@/lib/api/admin-handler";

const DAY_MS = 24 * 60 * 60 * 1000;

const examsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(ADMIN_EXAMS_DEFAULT_PAGE),
  limit: z.coerce.number().int().min(1).max(ADMIN_EXAMS_MAX_LIMIT).default(ADMIN_EXAMS_DEFAULT_LIMIT),
  range: z.enum(["7d", "30d", "90d", "custom"]).default("30d"),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  passStatus: z.enum(["all", "passed", "failed"]).default("all"),
  scoreMin: z.coerce.number().min(ADMIN_EXAMS_MIN_SCORE).max(ADMIN_EXAMS_MAX_SCORE).default(ADMIN_EXAMS_MIN_SCORE),
  scoreMax: z.coerce.number().min(ADMIN_EXAMS_MIN_SCORE).max(ADMIN_EXAMS_MAX_SCORE).default(ADMIN_EXAMS_MAX_SCORE),
  cadetName: z.string().trim().max(120).optional(),
  userId: z.string().trim().max(120).optional(),
  attempt: z.enum(["all", "first", "retake"]).default("all"),
});

interface AdminExamsSuccessResponse {
  success: true;
  data: AdminRecentExamAttemptsPayload;
}

interface DateRangeBounds {
  completedFromMs?: number;
  completedToMs?: number;
}

function startOfUtcDay(timestampMs: number): number {
  const date = new Date(timestampMs);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function endOfUtcDay(timestampMs: number): number {
  return startOfUtcDay(timestampMs) + DAY_MS - 1;
}

function parseDateUtcStart(dateText: string): number {
  return Date.parse(`${dateText}T00:00:00.000Z`);
}

function parseDateUtcEnd(dateText: string): number {
  return Date.parse(`${dateText}T23:59:59.999Z`);
}

function resolveDateRangeBounds(input: {
  range: AdminExamDateRange;
  from?: string;
  to?: string;
}): { ok: true; value: DateRangeBounds } | { ok: false; message: string } {
  if (input.range === "custom") {
    if (!input.from || !input.to) {
      return {
        ok: false,
        message: "Custom date range requires both from and to dates.",
      };
    }

    const fromMs = parseDateUtcStart(input.from);
    const toMs = parseDateUtcEnd(input.to);

    if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) {
      return {
        ok: false,
        message: "Custom date range values are invalid.",
      };
    }

    if (fromMs > toMs) {
      return {
        ok: false,
        message: "Custom date range start must be before end.",
      };
    }

    return {
      ok: true,
      value: {
        completedFromMs: fromMs,
        completedToMs: toMs,
      },
    };
  }

  const rangeDays = input.range === "7d" ? 7 : input.range === "30d" ? 30 : 90;
  const now = Date.now();
  const completedToMs = endOfUtcDay(now);
  const completedFromMs = startOfUtcDay(now - (rangeDays - 1) * DAY_MS);

  return {
    ok: true,
    value: {
      completedFromMs,
      completedToMs,
    },
  };
}

function resolvePassFilter(
  passStatus: AdminExamPassStatus
): boolean | undefined {
  if (passStatus === "passed") {
    return true;
  }

  if (passStatus === "failed") {
    return false;
  }

  return undefined;
}

function resolveAttemptFilter(
  attemptFilter: AdminExamAttemptFilter
): "first" | "retake" | undefined {
  if (attemptFilter === "all") {
    return undefined;
  }
  return attemptFilter;
}

export const GET = withAdminApiGuard(async (req, { convexToken }) => {
  const url = new URL(req.url);
  const parsedQuery = examsQuerySchema.safeParse({
    page: url.searchParams.get("page") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
    range: url.searchParams.get("range") ?? undefined,
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
    passStatus: url.searchParams.get("passStatus") ?? undefined,
    scoreMin: url.searchParams.get("scoreMin") ?? undefined,
    scoreMax: url.searchParams.get("scoreMax") ?? undefined,
    cadetName: url.searchParams.get("cadetName") ?? undefined,
    userId: url.searchParams.get("userId") ?? undefined,
    attempt: url.searchParams.get("attempt") ?? undefined,
  });

  if (!parsedQuery.success) {
    return adminApiErrorResponse(400, "INVALID_QUERY", "Invalid exams query parameters.");
  }

  if (parsedQuery.data.scoreMin > parsedQuery.data.scoreMax) {
    return adminApiErrorResponse(
      400,
      "INVALID_QUERY",
      "scoreMin must be less than or equal to scoreMax."
    );
  }

  const dateBounds = resolveDateRangeBounds({
    range: parsedQuery.data.range,
    from: parsedQuery.data.from,
    to: parsedQuery.data.to,
  });

  if (!dateBounds.ok) {
    return adminApiErrorResponse(400, "INVALID_QUERY", dateBounds.message);
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

    const data = await convex.query(api.exams.getAdminRecentExamAttempts, {
      page: parsedQuery.data.page,
      limit: parsedQuery.data.limit,
      completedFromMs: dateBounds.value.completedFromMs,
      completedToMs: dateBounds.value.completedToMs,
      passed: resolvePassFilter(parsedQuery.data.passStatus),
      scoreMin: parsedQuery.data.scoreMin,
      scoreMax: parsedQuery.data.scoreMax,
      cadetNameQuery: parsedQuery.data.cadetName?.trim() || undefined,
      userIdQuery: parsedQuery.data.userId?.trim() || undefined,
      attemptFilter: resolveAttemptFilter(parsedQuery.data.attempt),
    });

    if (!data) {
      return adminApiErrorResponse(403, "FORBIDDEN", "Administrator access is required.");
    }

    const body: AdminExamsSuccessResponse = {
      success: true,
      data,
    };

    return Response.json(body, {
      status: 200,
      headers: {
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return adminApiErrorResponse(
      500,
      "INTERNAL_ERROR",
      "Failed to fetch recent exam attempts."
    );
  }
});
