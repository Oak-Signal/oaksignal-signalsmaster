import { ConvexHttpClient } from "convex/browser";
import { z } from "zod";

import { api } from "@/convex/_generated/api";
import {
  ADMIN_EXAMS_DEFAULT_LIMIT,
  ADMIN_EXAMS_DEFAULT_PAGE,
  ADMIN_EXAMS_MAX_LIMIT,
  AdminRecentExamAttemptsPayload,
} from "@/lib/admin-exams-types";
import { adminApiErrorResponse, withAdminApiGuard } from "@/lib/api/admin-handler";

const examsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(ADMIN_EXAMS_DEFAULT_PAGE),
  limit: z.coerce.number().int().min(1).max(ADMIN_EXAMS_MAX_LIMIT).default(ADMIN_EXAMS_DEFAULT_LIMIT),
});

interface AdminExamsSuccessResponse {
  success: true;
  data: AdminRecentExamAttemptsPayload;
}

export const GET = withAdminApiGuard(async (req, { convexToken }) => {
  const url = new URL(req.url);
  const parsedQuery = examsQuerySchema.safeParse({
    page: url.searchParams.get("page") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  });

  if (!parsedQuery.success) {
    return adminApiErrorResponse(400, "INVALID_QUERY", "Invalid exams query parameters.");
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
