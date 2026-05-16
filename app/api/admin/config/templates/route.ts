import { ConvexHttpClient } from "convex/browser";
import { z } from "zod";

import { api } from "@/convex/_generated/api";
import { adminApiErrorResponse, withAdminApiGuard } from "@/lib/api/admin-handler";

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

const createTemplateBodySchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(300).optional(),
  settings: z.object({
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
  }),
});

const templatesQuerySchema = z.object({
  includeArchived: z.coerce.boolean().optional(),
});

interface AdminTemplateRecord {
  _id: string;
  name: string;
  description?: string;
  settings: {
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
  };
  archivedAt?: number;
  archivedBy?: string;
  updatedBy: string;
  createdAt: number;
  updatedAt: number;
}

interface AdminTemplatesListResponse {
  success: true;
  data: AdminTemplateRecord[];
}

interface AdminTemplateMutationResponse {
  success: true;
  data: AdminTemplateRecord;
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

function mapTemplateRecord(input: {
  _id: string;
  name: string;
  description?: string;
  settings: {
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
  };
  archivedAt?: number;
  archivedBy?: string;
  updatedBy: string;
  createdAt: number;
  updatedAt: number;
}): AdminTemplateRecord {
  return {
    ...input,
    archivedBy: input.archivedBy,
    updatedBy: input.updatedBy,
  };
}

function mapTemplateMutationError(error: unknown): Response {
  const message = error instanceof Error ? error.message : "Failed to save template.";

  if (message.includes("not found")) {
    return adminApiErrorResponse(404, "NOT_FOUND", "Template was not found.");
  }

  if (
    message.includes("must") ||
    message.includes("required") ||
    message.includes("characters") ||
    message.includes("format")
  ) {
    return adminApiErrorResponse(400, "INVALID_REQUEST", message);
  }

  if (message.includes("Administrator access is required")) {
    return adminApiErrorResponse(403, "FORBIDDEN", "Administrator access is required.");
  }

  return adminApiErrorResponse(500, "INTERNAL_ERROR", "Failed to process template request.");
}

export const GET = withAdminApiGuard(async (req, { convexToken }) => {
  const url = new URL(req.url);
  const parsedQuery = templatesQuerySchema.safeParse({
    includeArchived: url.searchParams.get("includeArchived") ?? undefined,
  });

  if (!parsedQuery.success) {
    return adminApiErrorResponse(400, "INVALID_QUERY", "Invalid templates query parameters.");
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
    const data = await convex.query(api.exams.listAdminExamTemplates, {
      includeArchived: parsedQuery.data.includeArchived,
    });

    if (!data) {
      return adminApiErrorResponse(403, "FORBIDDEN", "Administrator access is required.");
    }

    const response: AdminTemplatesListResponse = {
      success: true,
      data: data.map((item) =>
        mapTemplateRecord({
          _id: item._id,
          name: item.name,
          description: item.description,
          settings: item.settings,
          archivedAt: item.archivedAt,
          archivedBy: item.archivedBy?.toString(),
          updatedBy: item.updatedBy.toString(),
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        })
      ),
    };

    return Response.json(response, {
      status: 200,
      headers: {
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return adminApiErrorResponse(500, "INTERNAL_ERROR", "Failed to load templates.");
  }
});

export const POST = withAdminApiGuard(async (req, { convexToken }) => {
  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return adminApiErrorResponse(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const parsedBody = createTemplateBodySchema.safeParse(body);
  if (!parsedBody.success) {
    return adminApiErrorResponse(400, "INVALID_REQUEST", "Invalid template payload.");
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
    const data = await convex.mutation(api.exams.createAdminExamTemplate, {
      name: parsedBody.data.name,
      description: parsedBody.data.description,
      settings: parsedBody.data.settings,
    });

    if (!data) {
      return adminApiErrorResponse(500, "INTERNAL_ERROR", "Template save returned no data.");
    }

    const response: AdminTemplateMutationResponse = {
      success: true,
      data: mapTemplateRecord({
        _id: data._id,
        name: data.name,
        description: data.description,
        settings: data.settings,
        archivedAt: data.archivedAt,
        archivedBy: data.archivedBy?.toString(),
        updatedBy: data.updatedBy.toString(),
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      }),
    };

    return Response.json(response, {
      status: 201,
      headers: {
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return mapTemplateMutationError(error);
  }
});
