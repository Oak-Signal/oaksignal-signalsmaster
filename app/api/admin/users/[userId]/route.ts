import { ConvexHttpClient } from "convex/browser";
import { z } from "zod";

import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { adminApiErrorResponse, withAdminApiGuard } from "@/lib/api/admin-handler";

const userProfileParamsSchema = z.object({
  userId: z.string().trim().min(1).max(128),
});

const userProfileQuerySchema = z.object({
  timelineLimit: z.coerce.number().int().min(1).max(100).optional(),
  historyLimit: z.coerce.number().int().min(1).max(100).optional(),
});

interface AdminUserProfileResponse {
  success: true;
  data: {
    profile: {
      userId: string;
      clerkId: string;
      name?: string;
      email: string;
      role: "admin" | "cadet";
      status: "active" | "suspended" | "banned" | "pending_verification";
      avatarUrl?: string;
      phone?: string;
      contactEmail?: string;
      createdAt: number;
      updatedAt: number;
      emailVerifiedAt?: number;
      lastLoginAt?: number;
      lastActiveAt: number;
      isFlaggedForReview: boolean;
      flaggedForReviewReason?: string;
    };
    activitySummary: {
      totalPracticeSessions: number;
      completedPracticeSessions: number;
      practiceAverageScore: number;
      examAttemptsCount: number;
      examResultsCount: number;
      examPassCount: number;
      examBestScore: number | null;
      rankedRunsCount: number;
      rankedBestScore: number | null;
      totalTimeSpentMs: number;
    };
    progress: {
      flagsMasteredCount: number;
      weakAreas: Array<{
        category: string;
        incorrectRatePercent: number;
      }>;
      learningStreakDays: number;
      sessionFrequencyPerWeek: number;
    };
    history: {
      roleChanges: Array<{
        _id: string;
        targetUserId: string;
        actorUserId: string;
        previousRole: "admin" | "cadet";
        newRole: "admin" | "cadet";
        reason: string;
        metadataJson?: string;
        createdAt: number;
      }>;
      statusChanges: Array<{
        _id: string;
        targetUserId: string;
        actorUserId: string;
        previousStatus: "active" | "suspended" | "banned" | "pending_verification";
        newStatus: "active" | "suspended" | "banned" | "pending_verification";
        reason: string;
        durationUntil?: number;
        internalNotes?: string;
        metadataJson?: string;
        createdAt: number;
      }>;
      adminNotes: Array<{
        _id: string;
        targetUserId: string;
        authorUserId: string;
        note: string;
        isPinned?: boolean;
        createdAt: number;
        updatedAt: number;
      }>;
      passwordResetRequests: unknown[];
      emailChangeHistory: unknown[];
    };
    activityMonitoring: {
      activityTimeline: Array<{
        _id: string;
        targetUserId: string;
        actorUserId?: string;
        eventType:
          | "login"
          | "logout"
          | "practice_completed"
          | "exam_completed"
          | "ranked_run_completed"
          | "role_changed"
          | "status_changed"
          | "admin_note_added"
          | "profile_updated"
          | "notification_sent"
          | "account_flagged"
          | "account_unflagged"
          | "data_export_requested";
        metadataJson?: string;
        createdAt: number;
      }>;
      loginHistory: Array<{
        _id: string;
        targetUserId: string;
        eventType: "login_success" | "login_failed" | "session_started" | "session_ended";
        ipAddress?: string;
        device?: string;
        userAgent?: string;
        sessionId?: string;
        metadataJson?: string;
        createdAt: number;
      }>;
      sessionHistory: Array<unknown>;
      examAttempts: Array<unknown>;
      rankedRuns: Array<{
        _id: string;
        targetUserId: string;
        actorUserId?: string;
        eventType: "ranked_run_completed";
        metadataJson?: string;
        createdAt: number;
      }>;
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

export const GET = withAdminApiGuard<{ userId: string }>(async (req, { convexToken, params }) => {
  const parsedParams = userProfileParamsSchema.safeParse(params);
  if (!parsedParams.success) {
    return adminApiErrorResponse(400, "INVALID_PARAMS", "Invalid user ID parameter.");
  }

  const url = new URL(req.url);
  const parsedQuery = userProfileQuerySchema.safeParse({
    timelineLimit: url.searchParams.get("timelineLimit") ?? undefined,
    historyLimit: url.searchParams.get("historyLimit") ?? undefined,
  });

  if (!parsedQuery.success) {
    return adminApiErrorResponse(400, "INVALID_QUERY", "Invalid profile query parameters.");
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
    const data = await convex.query(api.user_management.getAdminUserProfile, {
      userId: parsedParams.data.userId as Id<"users">,
      timelineLimit: parsedQuery.data.timelineLimit,
      historyLimit: parsedQuery.data.historyLimit,
    });

    if (!data) {
      return adminApiErrorResponse(404, "NOT_FOUND", "User not found.");
    }

    const response: AdminUserProfileResponse = {
      success: true,
      data: {
        profile: {
          ...data.profile,
          userId: data.profile.userId.toString(),
        },
        activitySummary: data.activitySummary,
        progress: data.progress,
        history: {
          roleChanges: data.history.roleChanges.map((item) => ({
            _id: item._id.toString(),
            targetUserId: item.targetUserId.toString(),
            actorUserId: item.actorUserId.toString(),
            previousRole: item.previousRole,
            newRole: item.newRole,
            reason: item.reason,
            metadataJson: item.metadataJson,
            createdAt: item.createdAt,
          })),
          statusChanges: data.history.statusChanges.map((item) => ({
            _id: item._id.toString(),
            targetUserId: item.targetUserId.toString(),
            actorUserId: item.actorUserId.toString(),
            previousStatus: item.previousStatus,
            newStatus: item.newStatus,
            reason: item.reason,
            durationUntil: item.durationUntil,
            internalNotes: item.internalNotes,
            metadataJson: item.metadataJson,
            createdAt: item.createdAt,
          })),
          adminNotes: data.history.adminNotes.map((item) => ({
            _id: item._id.toString(),
            targetUserId: item.targetUserId.toString(),
            authorUserId: item.authorUserId.toString(),
            note: item.note,
            isPinned: item.isPinned,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt,
          })),
          passwordResetRequests: data.history.passwordResetRequests,
          emailChangeHistory: data.history.emailChangeHistory,
        },
        activityMonitoring: {
          activityTimeline: data.activityMonitoring.activityTimeline.map((item) => ({
            _id: item._id.toString(),
            targetUserId: item.targetUserId.toString(),
            actorUserId: item.actorUserId?.toString(),
            eventType: item.eventType,
            metadataJson: item.metadataJson,
            createdAt: item.createdAt,
          })),
          loginHistory: data.activityMonitoring.loginHistory.map((item) => ({
            _id: item._id.toString(),
            targetUserId: item.targetUserId.toString(),
            eventType: item.eventType,
            ipAddress: item.ipAddress,
            device: item.device,
            userAgent: item.userAgent,
            sessionId: item.sessionId,
            metadataJson: item.metadataJson,
            createdAt: item.createdAt,
          })),
          sessionHistory: data.activityMonitoring.sessionHistory,
          examAttempts: data.activityMonitoring.examAttempts,
          rankedRuns: data.activityMonitoring.rankedRuns.map((item) => ({
            _id: item._id.toString(),
            targetUserId: item.targetUserId.toString(),
            actorUserId: item.actorUserId?.toString(),
            eventType: "ranked_run_completed",
            metadataJson: item.metadataJson,
            createdAt: item.createdAt,
          })),
        },
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
    return adminApiErrorResponse(500, "INTERNAL_ERROR", "Failed to load user profile.");
  }
});
