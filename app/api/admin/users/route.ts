import { ConvexHttpClient } from "convex/browser";
import { z } from "zod";

import { api } from "@/convex/_generated/api";
import { adminApiErrorResponse, withAdminApiGuard } from "@/lib/api/admin-handler";

const userRoleValues = ["admin", "cadet"] as const;
const userStatusValues = ["active", "suspended", "banned", "pending_verification"] as const;
const examPassValues = ["passed", "failed", "no_attempt"] as const;
const practiceActivityValues = ["none", "low", "medium", "high"] as const;
const rankedParticipationValues = ["participated", "not_participated"] as const;
const sortByValues = ["name", "email", "role", "createdAt", "lastActiveAt", "status"] as const;
const sortDirectionValues = ["asc", "desc"] as const;

const usersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(250).optional(),
  queryText: z.string().trim().max(120).optional(),
  role: z.enum(userRoleValues).optional(),
  status: z.enum(userStatusValues).optional(),
  registeredFromMs: z.coerce.number().int().min(0).optional(),
  registeredToMs: z.coerce.number().int().min(0).optional(),
  lastActiveFromMs: z.coerce.number().int().min(0).optional(),
  lastActiveToMs: z.coerce.number().int().min(0).optional(),
  examPassFilter: z.enum(examPassValues).optional(),
  practiceActivityLevel: z.enum(practiceActivityValues).optional(),
  rankedParticipation: z.enum(rankedParticipationValues).optional(),
  includeDeleted: z.coerce.boolean().optional(),
  sortBy: z.enum(sortByValues).optional(),
  sortDirection: z.enum(sortDirectionValues).optional(),
});

interface AdminUsersListResponse {
  success: true;
  data: {
    items: Array<{
      userId: string;
      clerkId: string;
      name?: string;
      email: string;
      role: (typeof userRoleValues)[number];
      status: (typeof userStatusValues)[number];
      avatarUrl?: string;
      createdAt: number;
      lastActiveAt: number;
      isOnline: boolean;
      emailVerifiedAt?: number;
      practiceCompletedSessions: number;
      examPassedCount: number;
      examFailedCount: number;
      rankedRunsCount: number;
    }>;
    pagination: {
      page: number;
      limit: number;
      totalCount: number;
      totalPages: number;
    };
    filtersApplied: {
      queryText?: string;
      role?: (typeof userRoleValues)[number];
      status?: (typeof userStatusValues)[number];
      registeredFromMs?: number;
      registeredToMs?: number;
      lastActiveFromMs?: number;
      lastActiveToMs?: number;
      examPassFilter?: (typeof examPassValues)[number];
      practiceActivityLevel?: (typeof practiceActivityValues)[number];
      rankedParticipation?: (typeof rankedParticipationValues)[number];
      includeDeleted: boolean;
      sortBy: (typeof sortByValues)[number];
      sortDirection: (typeof sortDirectionValues)[number];
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

  const parsedQuery = usersQuerySchema.safeParse({
    page: url.searchParams.get("page") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
    queryText: url.searchParams.get("queryText") ?? undefined,
    role: url.searchParams.get("role") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
    registeredFromMs: url.searchParams.get("registeredFromMs") ?? undefined,
    registeredToMs: url.searchParams.get("registeredToMs") ?? undefined,
    lastActiveFromMs: url.searchParams.get("lastActiveFromMs") ?? undefined,
    lastActiveToMs: url.searchParams.get("lastActiveToMs") ?? undefined,
    examPassFilter: url.searchParams.get("examPassFilter") ?? undefined,
    practiceActivityLevel: url.searchParams.get("practiceActivityLevel") ?? undefined,
    rankedParticipation: url.searchParams.get("rankedParticipation") ?? undefined,
    includeDeleted: url.searchParams.get("includeDeleted") ?? undefined,
    sortBy: url.searchParams.get("sortBy") ?? undefined,
    sortDirection: url.searchParams.get("sortDirection") ?? undefined,
  });

  if (!parsedQuery.success) {
    return adminApiErrorResponse(400, "INVALID_QUERY", "Invalid users query parameters.");
  }

  if (
    typeof parsedQuery.data.registeredFromMs === "number" &&
    typeof parsedQuery.data.registeredToMs === "number" &&
    parsedQuery.data.registeredFromMs > parsedQuery.data.registeredToMs
  ) {
    return adminApiErrorResponse(
      400,
      "INVALID_QUERY",
      "registeredFromMs must be less than or equal to registeredToMs."
    );
  }

  if (
    typeof parsedQuery.data.lastActiveFromMs === "number" &&
    typeof parsedQuery.data.lastActiveToMs === "number" &&
    parsedQuery.data.lastActiveFromMs > parsedQuery.data.lastActiveToMs
  ) {
    return adminApiErrorResponse(
      400,
      "INVALID_QUERY",
      "lastActiveFromMs must be less than or equal to lastActiveToMs."
    );
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
    const data = await convex.query(api.user_management.getAdminUsersList, parsedQuery.data);
    if (!data) {
      return adminApiErrorResponse(403, "FORBIDDEN", "Administrator access is required.");
    }

    const response: AdminUsersListResponse = {
      success: true,
      data: {
        items: data.items.map((item) => ({
          userId: item.userId.toString(),
          clerkId: item.clerkId,
          name: item.name,
          email: item.email,
          role: item.role,
          status: item.status,
          avatarUrl: item.avatarUrl,
          createdAt: item.createdAt,
          lastActiveAt: item.lastActiveAt,
          isOnline: item.isOnline,
          emailVerifiedAt: item.emailVerifiedAt,
          practiceCompletedSessions: item.practiceCompletedSessions,
          examPassedCount: item.examPassedCount,
          examFailedCount: item.examFailedCount,
          rankedRunsCount: item.rankedRunsCount,
        })),
        pagination: data.pagination,
        filtersApplied: data.filtersApplied,
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
    return adminApiErrorResponse(500, "INTERNAL_ERROR", "Failed to load users.");
  }
});
