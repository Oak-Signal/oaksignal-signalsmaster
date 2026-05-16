import { Doc } from "../../_generated/dataModel";
import { MutationCtx } from "../../_generated/server";

export type AdminActionType =
  | "system_config_updated"
  | "maintenance_mode_enabled"
  | "maintenance_mode_disabled"
  | "exam_template_created"
  | "exam_template_updated"
  | "exam_template_archived";

export type AdminActionTargetType = "system_config" | "exam_template";

export async function insertAdminActionLog(
  ctx: MutationCtx,
  input: {
    actorUser: Doc<"users">;
    actionType: AdminActionType;
    targetType: AdminActionTargetType;
    targetId?: string;
    outcome?: "success" | "failure";
    message: string;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  await ctx.db.insert("adminActionLogs", {
    actorUserId: input.actorUser._id,
    actorRole: input.actorUser.role,
    actionType: input.actionType,
    targetType: input.targetType,
    targetId: input.targetId,
    outcome: input.outcome ?? "success",
    message: input.message,
    metadataJson: input.metadata ? JSON.stringify(input.metadata) : undefined,
    createdAt: Date.now(),
  });
}
