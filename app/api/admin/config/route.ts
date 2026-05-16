import { ConvexHttpClient } from "convex/browser";
import { z } from "zod";

import { api } from "@/convex/_generated/api";
import { adminApiErrorResponse, withAdminApiGuard } from "@/lib/api/admin-handler";

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

const systemConfigBodySchema = z.object({
  examEnabled: z.boolean(),
  questionCount: z.coerce.number().int().min(4).max(200),
  passThreshold: z.coerce.number().int().min(1).max(100),
  availabilityWindow: z.object({
    startDate: z.string().regex(dateRegex),
    endDate: z.string().regex(dateRegex),
    startTime: z.string().regex(timeRegex),
    endTime: z.string().regex(timeRegex),
    timeZone: z.string().trim().min(1).max(100).optional(),
  }),
  maxRetakes: z.coerce.number().int().min(0).max(20),
  retakeCooldownHours: z.coerce.number().int().min(0).max(24 * 30),
  maintenanceModeEnabled: z.boolean(),
  maintenanceMessage: z.string().trim().max(500).optional(),
});

interface AdminSystemConfigResponse {
  success: true;
  data: {
    _id?: string;
    configKey: string;
    examEnabled: boolean;
    questionCount: number;
    passThreshold: number;
    availabilityWindow: {
      startDate: string;
      endDate: string;
      startTime: string;
      endTime: string;
      timeZone?: string;
    };
    maxRetakes: number;
    retakeCooldownHours: number;
    maintenanceModeEnabled: boolean;
    maintenanceMessage?: string;
    updatedBy: string;
    updatedAt: number | null;
    createdAt: number | null;
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

function mapMutationError(error: unknown): Response {
  const message = error instanceof Error ? error.message : "Failed to update system config.";

  if (
    message.includes("must be") ||
    message.includes("required") ||
    message.includes("characters") ||
    message.includes("format")
  ) {
    return adminApiErrorResponse(400, "INVALID_REQUEST", message);
  }

  if (message.includes("Administrator access is required")) {
    return adminApiErrorResponse(403, "FORBIDDEN", "Administrator access is required.");
  }

  return adminApiErrorResponse(500, "INTERNAL_ERROR", "Failed to update system config.");
}

export const GET = withAdminApiGuard(async (_req, { convexToken }) => {
  const convex = getConvexClient(convexToken);
  if (!convex) {
    return adminApiErrorResponse(
      500,
      "SERVER_MISCONFIGURED",
      "Convex URL is not configured."
    );
  }

  try {
    const data = await convex.query(api.exams.getAdminSystemConfig, {});
    if (!data) {
      return adminApiErrorResponse(403, "FORBIDDEN", "Administrator access is required.");
    }

    const response: AdminSystemConfigResponse = {
      success: true,
      data: {
        ...data,
        _id: "_id" in data && typeof data._id === "string" ? data._id : undefined,
        updatedBy: data.updatedBy.toString(),
      },
    };

    return Response.json(response, {
      status: 200,
      headers: {
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return adminApiErrorResponse(500, "INTERNAL_ERROR", "Failed to load system config.");
  }
});

export const PUT = withAdminApiGuard(async (req, { convexToken }) => {
  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return adminApiErrorResponse(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const parsedBody = systemConfigBodySchema.safeParse(body);
  if (!parsedBody.success) {
    return adminApiErrorResponse(400, "INVALID_REQUEST", "Invalid system config payload.");
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
    const data = await convex.mutation(api.exams.upsertAdminSystemConfig, {
      examEnabled: parsedBody.data.examEnabled,
      questionCount: parsedBody.data.questionCount,
      passThreshold: parsedBody.data.passThreshold,
      availabilityWindow: {
        startDate: parsedBody.data.availabilityWindow.startDate,
        endDate: parsedBody.data.availabilityWindow.endDate,
        startTime: parsedBody.data.availabilityWindow.startTime,
        endTime: parsedBody.data.availabilityWindow.endTime,
        timeZone: parsedBody.data.availabilityWindow.timeZone,
      },
      maxRetakes: parsedBody.data.maxRetakes,
      retakeCooldownHours: parsedBody.data.retakeCooldownHours,
      maintenanceModeEnabled: parsedBody.data.maintenanceModeEnabled,
      maintenanceMessage: parsedBody.data.maintenanceMessage?.trim() || undefined,
    });

    const response: AdminSystemConfigResponse = {
      success: true,
      data: {
        ...data,
        _id: data._id,
        updatedBy: data.updatedBy.toString(),
      },
    };

    return Response.json(response, {
      status: 200,
      headers: {
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return mapMutationError(error);
  }
});
