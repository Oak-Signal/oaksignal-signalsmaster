import { ConvexHttpClient } from "convex/browser";
import { z } from "zod";

import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { adminApiErrorResponse, withAdminApiGuard } from "@/lib/api/admin-handler";

const statusBodySchema = z.object({
  nextStatus: z.enum(["active", "suspended", "banned", "pending_verification"]),
  reason: z.string().trim().min(1).max(300),
  durationUntil: z.number().int().positive().optional(),
  internalNotes: z.string().trim().max(2000).optional(),
  notifyUser: z.boolean().optional(),
});

function mapMutationError(error: unknown): Response {
  const message = error instanceof Error ? error.message : "Failed to update user status.";

  if (message.includes("not found")) {
    return adminApiErrorResponse(404, "NOT_FOUND", "Target user was not found.");
  }

  if (
    message.includes("cannot suspend or ban your own account") ||
    message.includes("future timestamp")
  ) {
    return adminApiErrorResponse(409, "STATUS_GUARDRAIL", message);
  }

  if (message.includes("Reason") || message.includes("characters or less")) {
    return adminApiErrorResponse(400, "INVALID_REQUEST", message);
  }

  return adminApiErrorResponse(500, "INTERNAL_ERROR", "Failed to update user status.");
}

export const POST = withAdminApiGuard<{ userId: string }>(async (req, { convexToken, params }) => {
  const targetUserId = params.userId?.trim();
  if (!targetUserId) {
    return adminApiErrorResponse(400, "INVALID_PARAMS", "A valid userId parameter is required.");
  }

  let requestBody: unknown;
  try {
    requestBody = await req.json();
  } catch {
    return adminApiErrorResponse(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const parsedBody = statusBodySchema.safeParse(requestBody);
  if (!parsedBody.success) {
    return adminApiErrorResponse(400, "INVALID_REQUEST", "Invalid status update payload.");
  }

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    return adminApiErrorResponse(500, "SERVER_MISCONFIGURED", "Convex URL is not configured.");
  }

  try {
    const convex = new ConvexHttpClient(convexUrl);
    convex.setAuth(convexToken);

    const data = await convex.mutation(api.user_management.updateUserStatus, {
      targetUserId: targetUserId as Id<"users">,
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
          targetUserId: data.targetUserId.toString(),
          changed: data.changed,
          previousStatus: data.previousStatus,
          newStatus: data.newStatus,
          changedAt: data.changedAt,
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
