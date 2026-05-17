import { ConvexHttpClient } from "convex/browser";
import { z } from "zod";

import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { adminApiErrorResponse, withAdminApiGuard } from "@/lib/api/admin-handler";

const bulkBodySchema = z
  .object({
    targetUserIds: z.array(z.string().trim().min(1).max(128)).min(1).max(200),
    operation: z.enum(["set_role", "set_status"]),
    nextRole: z.enum(["admin", "cadet"]).optional(),
    nextStatus: z.enum(["active", "suspended", "banned", "pending_verification"]).optional(),
    reason: z.string().trim().min(1).max(300),
    durationUntil: z.number().int().positive().optional(),
    internalNotes: z.string().trim().max(2000).optional(),
    notifyUser: z.boolean().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.operation === "set_role" && !value.nextRole) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "nextRole is required for set_role operations.",
        path: ["nextRole"],
      });
    }

    if (value.operation === "set_status" && !value.nextStatus) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "nextStatus is required for set_status operations.",
        path: ["nextStatus"],
      });
    }
  });

function mapMutationError(error: unknown): Response {
  const message = error instanceof Error ? error.message : "Failed to run bulk action.";

  if (message.includes("At least one target user") || message.includes("limited to 200")) {
    return adminApiErrorResponse(400, "INVALID_REQUEST", message);
  }

  if (message.includes("Reason") || message.includes("characters or less")) {
    return adminApiErrorResponse(400, "INVALID_REQUEST", message);
  }

  return adminApiErrorResponse(500, "INTERNAL_ERROR", "Failed to run bulk action.");
}

export const POST = withAdminApiGuard(async (req, { convexToken }) => {
  let requestBody: unknown;
  try {
    requestBody = await req.json();
  } catch {
    return adminApiErrorResponse(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const parsedBody = bulkBodySchema.safeParse(requestBody);
  if (!parsedBody.success) {
    return adminApiErrorResponse(400, "INVALID_REQUEST", "Invalid bulk action payload.");
  }

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    return adminApiErrorResponse(500, "SERVER_MISCONFIGURED", "Convex URL is not configured.");
  }

  try {
    const convex = new ConvexHttpClient(convexUrl);
    convex.setAuth(convexToken);

    const data = await convex.mutation(api.user_management.bulkManageUsers, {
      targetUserIds: parsedBody.data.targetUserIds as Id<"users">[],
      operation: parsedBody.data.operation,
      nextRole: parsedBody.data.nextRole,
      nextStatus: parsedBody.data.nextStatus,
      reason: parsedBody.data.reason,
      durationUntil: parsedBody.data.durationUntil,
      internalNotes: parsedBody.data.internalNotes,
      notifyUser: parsedBody.data.notifyUser,
    });

    return Response.json(
      {
        success: true,
        data: {
          operation: data.operation,
          processed: data.processed,
          changed: data.changed,
          failed: data.failed,
          failures: data.failures,
          generatedAt: data.generatedAt,
        },
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "private, no-store",
        },
      }
    );
  } catch (error) {
    return mapMutationError(error);
  }
});
