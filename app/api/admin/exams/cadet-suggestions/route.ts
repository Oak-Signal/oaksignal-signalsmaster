import { ConvexHttpClient } from "convex/browser";
import { z } from "zod";

import { api } from "@/convex/_generated/api";
import {
  ADMIN_EXAMS_SUGGESTIONS_DEFAULT_LIMIT,
  ADMIN_EXAMS_SUGGESTIONS_MAX_LIMIT,
  AdminExamCadetSuggestion,
} from "@/lib/admin-exams-types";
import { adminApiErrorResponse, withAdminApiGuard } from "@/lib/api/admin-handler";

const cadetSuggestionsQuerySchema = z.object({
  query: z.string().trim().min(1).max(120),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(ADMIN_EXAMS_SUGGESTIONS_MAX_LIMIT)
    .default(ADMIN_EXAMS_SUGGESTIONS_DEFAULT_LIMIT),
});

interface AdminCadetSuggestionsResponse {
  success: true;
  data: AdminExamCadetSuggestion[];
}

export const GET = withAdminApiGuard(async (req, { convexToken }) => {
  const url = new URL(req.url);
  const parsedQuery = cadetSuggestionsQuerySchema.safeParse({
    query: url.searchParams.get("query") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  });

  if (!parsedQuery.success) {
    return adminApiErrorResponse(
      400,
      "INVALID_QUERY",
      "Invalid cadet suggestions query parameters."
    );
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

    const data = await convex.query(api.exams.getAdminExamCadetSuggestions, {
      query: parsedQuery.data.query,
      limit: parsedQuery.data.limit,
    });

    if (!data) {
      return adminApiErrorResponse(403, "FORBIDDEN", "Administrator access is required.");
    }

    const body: AdminCadetSuggestionsResponse = {
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
      "Failed to fetch cadet suggestions."
    );
  }
});
