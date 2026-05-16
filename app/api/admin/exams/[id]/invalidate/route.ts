import { ConvexHttpClient } from "convex/browser";
import { z } from "zod";

import { Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import { adminApiErrorResponse, withAdminApiGuard } from "@/lib/api/admin-handler";

const invalidateExamBodySchema = z.object({
  reason: z.enum([
    "suspected_cheating",
    "technical_issue_student_request",
    "proctor_decision",
    "other",
  ]),
  reasonDetails: z.string().trim().max(300).optional(),
});

interface InvalidateExamSuccessResponse {
  success: true;
  data: {
    examResultId: string;
    invalidated: true;
    invalidatedAt: number;
    invalidatedBy: string;
    invalidationReason:
      | "suspected_cheating"
      | "technical_issue_student_request"
      | "proctor_decision"
      | "other";
    invalidationReasonDetails?: string;
  };
}

function isLikelyConvexId(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= 128;
}

function mapInvalidateMutationErrorToResponse(error: unknown): Response {
  const message = error instanceof Error ? error.message : "Failed to invalidate exam result.";

  if (message.includes("not found")) {
    return adminApiErrorResponse(404, "NOT_FOUND", "Exam result was not found.");
  }

  if (message.includes("already been invalidated")) {
    return adminApiErrorResponse(409, "ALREADY_INVALIDATED", message);
  }

  if (
    message.includes("Invalid invalidation reason") ||
    message.includes("required when reason is set to other") ||
    message.includes("characters or less")
  ) {
    return adminApiErrorResponse(400, "INVALID_REQUEST", message);
  }

  return adminApiErrorResponse(500, "INTERNAL_ERROR", "Failed to invalidate exam result.");
}

export const POST = withAdminApiGuard<{ id: string }>(async (req, { convexToken, params }) => {
  const resultId = params.id?.trim();
  if (!resultId || !isLikelyConvexId(resultId)) {
    return adminApiErrorResponse(400, "INVALID_REQUEST", "A valid exam result ID is required.");
  }

  let requestBody: unknown;
  try {
    requestBody = await req.json();
  } catch {
    return adminApiErrorResponse(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const parsedBody = invalidateExamBodySchema.safeParse(requestBody);
  if (!parsedBody.success) {
    return adminApiErrorResponse(400, "INVALID_REQUEST", "Invalid invalidation request payload.");
  }

  if (parsedBody.data.reason === "other" && !parsedBody.data.reasonDetails?.trim()) {
    return adminApiErrorResponse(
      400,
      "INVALID_REQUEST",
      "reasonDetails is required when reason is set to other."
    );
  }

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    return adminApiErrorResponse(500, "SERVER_MISCONFIGURED", "Convex URL is not configured.");
  }

  try {
    const convex = new ConvexHttpClient(convexUrl);
    convex.setAuth(convexToken);

    const invalidatedResult = await convex.mutation(api.exams.invalidateOfficialResult, {
      examResultId: resultId as Id<"examResults">,
      reason: parsedBody.data.reason,
      reasonDetails: parsedBody.data.reasonDetails?.trim() || undefined,
    });

    if (!invalidatedResult) {
      return adminApiErrorResponse(403, "FORBIDDEN", "Administrator access is required.");
    }

    const invalidatedAt = invalidatedResult.invalidatedAt;
    const invalidatedBy = invalidatedResult.invalidatedBy;
    const invalidatedReason = invalidatedResult.invalidationReason;

    if (
      typeof invalidatedAt !== "number" ||
      typeof invalidatedBy !== "string" ||
      invalidatedReason === undefined
    ) {
      return adminApiErrorResponse(500, "INTERNAL_ERROR", "Invalid invalidation response payload.");
    }

    const response: InvalidateExamSuccessResponse = {
      success: true,
      data: {
        examResultId: invalidatedResult.examResultId,
        invalidated: true,
        invalidatedAt,
        invalidatedBy,
        invalidationReason: invalidatedReason,
        invalidationReasonDetails: invalidatedResult.invalidationReasonDetails,
      },
    };

    return Response.json(response, {
      status: 200,
      headers: {
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return mapInvalidateMutationErrorToResponse(error);
  }
});
