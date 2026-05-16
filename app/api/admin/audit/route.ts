import { ConvexHttpClient } from "convex/browser";
import { z } from "zod";

import { api } from "@/convex/_generated/api";
import { adminApiErrorResponse, withAdminApiGuard } from "@/lib/api/admin-handler";

const actionTypeValues = [
  "system_config_updated",
  "maintenance_mode_enabled",
  "maintenance_mode_disabled",
  "exam_template_created",
  "exam_template_updated",
  "exam_template_archived",
] as const;

const targetTypeValues = ["system_config", "exam_template"] as const;
const outcomeValues = ["success", "failure"] as const;

const auditQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  actionType: z.enum(actionTypeValues).optional(),
  targetType: z.enum(targetTypeValues).optional(),
  outcome: z.enum(outcomeValues).optional(),
  fromMs: z.coerce.number().int().min(0).optional(),
  toMs: z.coerce.number().int().min(0).optional(),
  queryText: z.string().trim().max(120).optional(),
});

interface AdminAuditResponse {
  success: true;
  data: {
    items: Array<{
      _id: string;
      actorUserId: string;
      actorRole: "admin" | "cadet" | "unknown";
      actionType: (typeof actionTypeValues)[number];
      targetType: (typeof targetTypeValues)[number];
      targetId?: string;
      outcome: (typeof outcomeValues)[number];
      message: string;
      metadataJson?: string;
      createdAt: number;
      actorDisplayName: string;
      actorEmail: string;
    }>;
    pagination: {
      page: number;
      limit: number;
      totalCount: number;
      totalPages: number;
    };
    generatedAt: number;
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

export const GET = withAdminApiGuard(async (req, { convexToken }) => {
  const url = new URL(req.url);
  const parsedQuery = auditQuerySchema.safeParse({
    page: url.searchParams.get("page") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
    actionType: url.searchParams.get("actionType") ?? undefined,
    targetType: url.searchParams.get("targetType") ?? undefined,
    outcome: url.searchParams.get("outcome") ?? undefined,
    fromMs: url.searchParams.get("fromMs") ?? undefined,
    toMs: url.searchParams.get("toMs") ?? undefined,
    queryText: url.searchParams.get("queryText") ?? undefined,
  });

  if (!parsedQuery.success) {
    return adminApiErrorResponse(400, "INVALID_QUERY", "Invalid audit query parameters.");
  }

  if (
    typeof parsedQuery.data.fromMs === "number" &&
    typeof parsedQuery.data.toMs === "number" &&
    parsedQuery.data.fromMs > parsedQuery.data.toMs
  ) {
    return adminApiErrorResponse(400, "INVALID_QUERY", "fromMs must be less than or equal to toMs.");
  }

  const convex = getConvexClient(convexToken);
  if (!convex) {
    return adminApiErrorResponse(
      500,
      "SERVER_MISCONFIGURED",
      "Convex URL is not configured."
    );
  }

  try {
    const data = await convex.query(api.exams.getAdminActionLogs, {
      page: parsedQuery.data.page,
      limit: parsedQuery.data.limit,
      actionType: parsedQuery.data.actionType,
      targetType: parsedQuery.data.targetType,
      outcome: parsedQuery.data.outcome,
      fromMs: parsedQuery.data.fromMs,
      toMs: parsedQuery.data.toMs,
      queryText: parsedQuery.data.queryText,
    });

    if (!data) {
      return adminApiErrorResponse(403, "FORBIDDEN", "Administrator access is required.");
    }

    const response: AdminAuditResponse = {
      success: true,
      data: {
        items: data.items.map((item) => ({
          _id: item._id,
          actorUserId: item.actorUserId.toString(),
          actorRole: item.actorRole,
          actionType: item.actionType,
          targetType: item.targetType,
          targetId: item.targetId,
          outcome: item.outcome,
          message: item.message,
          metadataJson: item.metadataJson,
          createdAt: item.createdAt,
          actorDisplayName: item.actorDisplayName,
          actorEmail: item.actorEmail,
        })),
        pagination: data.pagination,
        generatedAt: data.generatedAt,
      },
    };

    return Response.json(response, {
      status: 200,
      headers: {
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return adminApiErrorResponse(500, "INTERNAL_ERROR", "Failed to load audit logs.");
  }
});
