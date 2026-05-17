import { ConvexHttpClient } from "convex/browser";
import { z } from "zod";

import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { adminApiErrorResponse, withAdminApiGuard } from "@/lib/api/admin-handler";

const notesBodySchema = z.object({
  note: z.string().trim().min(1).max(2000),
  isPinned: z.boolean().optional(),
});

function mapMutationError(error: unknown): Response {
  const message = error instanceof Error ? error.message : "Failed to add admin note.";

  if (message.includes("not found")) {
    return adminApiErrorResponse(404, "NOT_FOUND", "Target user was not found.");
  }

  if (message.includes("Note") || message.includes("characters or less")) {
    return adminApiErrorResponse(400, "INVALID_REQUEST", message);
  }

  return adminApiErrorResponse(500, "INTERNAL_ERROR", "Failed to add admin note.");
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

  const parsedBody = notesBodySchema.safeParse(requestBody);
  if (!parsedBody.success) {
    return adminApiErrorResponse(400, "INVALID_REQUEST", "Invalid admin note payload.");
  }

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    return adminApiErrorResponse(500, "SERVER_MISCONFIGURED", "Convex URL is not configured.");
  }

  try {
    const convex = new ConvexHttpClient(convexUrl);
    convex.setAuth(convexToken);

    const data = await convex.mutation(api.user_management.addUserAdminNote, {
      targetUserId: targetUserId as Id<"users">,
      note: parsedBody.data.note,
      isPinned: parsedBody.data.isPinned,
    });

    return Response.json(
      {
        success: true,
        data: {
          noteId: data.noteId.toString(),
          targetUserId: data.targetUserId.toString(),
          createdAt: data.createdAt,
        },
      },
      {
        status: 201,
        headers: {
          "Cache-Control": "private, no-store",
        },
      }
    );
  } catch (error) {
    return mapMutationError(error);
  }
});
