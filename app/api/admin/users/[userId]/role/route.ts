import { ConvexHttpClient } from "convex/browser";
import { z } from "zod";

import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { adminApiErrorResponse, withAdminApiGuard } from "@/lib/api/admin-handler";

const roleBodySchema = z.object({
  nextRole: z.enum(["admin", "cadet"]),
  reason: z.string().trim().min(1).max(300),
  notifyUser: z.boolean().optional(),
});

function mapMutationError(error: unknown): Response {
  const message = error instanceof Error ? error.message : "Failed to update user role.";

  if (message.includes("not found")) {
    return adminApiErrorResponse(404, "NOT_FOUND", "Target user was not found.");
  }

  if (
    message.includes("cannot remove your own administrator role") ||
    message.includes("At least one administrator")
  ) {
    return adminApiErrorResponse(409, "ROLE_GUARDRAIL", message);
  }

  if (message.includes("Reason")) {
    return adminApiErrorResponse(400, "INVALID_REQUEST", message);
  }

  return adminApiErrorResponse(500, "INTERNAL_ERROR", "Failed to update user role.");
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

  const parsedBody = roleBodySchema.safeParse(requestBody);
  if (!parsedBody.success) {
    return adminApiErrorResponse(400, "INVALID_REQUEST", "Invalid role update payload.");
  }

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    return adminApiErrorResponse(500, "SERVER_MISCONFIGURED", "Convex URL is not configured.");
  }

  try {
    const convex = new ConvexHttpClient(convexUrl);
    convex.setAuth(convexToken);

    const data = await convex.mutation(api.user_management.updateUserRole, {
      targetUserId: targetUserId as Id<"users">,
      nextRole: parsedBody.data.nextRole,
      reason: parsedBody.data.reason,
      notifyUser: parsedBody.data.notifyUser,
    });

    return Response.json(
      {
        success: true,
        data: {
          targetUserId: data.targetUserId.toString(),
          changed: data.changed,
          previousRole: data.previousRole,
          newRole: data.newRole,
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
