import "server-only";

import { ConvexHttpClient } from "convex/browser";

import { api } from "@/convex/_generated/api";
import { Doc } from "@/convex/_generated/dataModel";

export type AdminAccessActorRole = Doc<"users">["role"] | "unknown";

export interface LogAdminAccessAttemptInput {
  actorUserId?: Doc<"users">["_id"];
  actorClerkId?: string;
  actorRole: AdminAccessActorRole;
  surface: "page" | "api";
  target: string;
  method?: string;
  outcome: "allowed" | "denied";
  reason?: string;
  metadata?: Record<string, unknown>;
  convexToken?: string | null;
}

function getConvexUrl(): string | null {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  return convexUrl && convexUrl.length > 0 ? convexUrl : null;
}

export async function logAdminAccessAttempt(
  input: LogAdminAccessAttemptInput
): Promise<void> {
  const convexUrl = getConvexUrl();
  if (!convexUrl) {
    return;
  }

  try {
    const convex = new ConvexHttpClient(convexUrl);
    if (input.convexToken) {
      convex.setAuth(input.convexToken);
    }

    await convex.mutation(api.admin_access_logs.logAccessAttempt, {
      actorUserId: input.actorUserId,
      actorClerkId: input.actorClerkId,
      actorRole: input.actorRole,
      surface: input.surface,
      target: input.target,
      method: input.method,
      outcome: input.outcome,
      reason: input.reason,
      metadataJson: input.metadata ? JSON.stringify(input.metadata) : undefined,
    });
  } catch (error) {
    console.error("[admin-access-audit] failed to persist access attempt", error);
  }
}
