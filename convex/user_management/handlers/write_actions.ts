import { mutation } from "../../_generated/server";
import { v } from "convex/values";

import { Doc, Id } from "../../_generated/dataModel";
import { MutationCtx } from "../../_generated/server";
import { requireAdminUser } from "../../lib/auth";

type UserStatus = "active" | "suspended" | "banned" | "pending_verification";

const MAX_REASON_LENGTH = 300;
const MAX_NOTES_LENGTH = 2_000;

function normalizeRequiredText(value: string, fieldName: string, maxLength: number): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new Error(`${fieldName} is required.`);
  }

  if (trimmed.length > maxLength) {
    throw new Error(`${fieldName} must be ${maxLength} characters or less.`);
  }

  return trimmed;
}

function normalizeOptionalText(value: string | undefined, maxLength: number): string | undefined {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return undefined;
  }

  if (trimmed.length > maxLength) {
    throw new Error(`Field must be ${maxLength} characters or less.`);
  }

  return trimmed;
}

function inferUserStatus(user: Doc<"users">): UserStatus {
  return user.status ?? "active";
}

async function insertNotification(
  ctx: MutationCtx,
  args: {
    recipientUserId: Id<"users">;
    type:
      | "role_changed"
      | "account_suspended"
      | "account_reactivated"
      | "account_banned"
      | "account_pending_verification"
      | "admin_message";
    title: string;
    message: string;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  await ctx.db.insert("notifications", {
    recipientUserId: args.recipientUserId,
    type: args.type,
    title: args.title,
    message: args.message,
    metadataJson: args.metadata ? JSON.stringify(args.metadata) : undefined,
    createdAt: Date.now(),
  });
}

async function updateUserRoleInternal(
  ctx: MutationCtx,
  args: {
    actor: Doc<"users">;
    targetUserId: Id<"users">;
    nextRole: "admin" | "cadet";
    reason: string;
    notifyUser: boolean;
  }
): Promise<{ changed: boolean; previousRole: "admin" | "cadet"; newRole: "admin" | "cadet" }> {
  const targetUser = await ctx.db.get(args.targetUserId);
  if (!targetUser) {
    throw new Error("Target user was not found.");
  }

  const previousRole = targetUser.role;
  const newRole = args.nextRole;

  if (args.actor._id === targetUser._id && previousRole === "admin" && newRole === "cadet") {
    throw new Error("You cannot remove your own administrator role.");
  }

  if (previousRole === "admin" && newRole === "cadet") {
    const admins = await ctx.db
      .query("users")
      .withIndex("by_role_createdAt", (q) => q.eq("role", "admin"))
      .collect();

    const activeAdmins = admins.filter((user) => user.deletedAt === undefined);
    if (activeAdmins.length <= 1) {
      throw new Error("At least one administrator must remain in the system.");
    }
  }

  if (previousRole === newRole) {
    return {
      changed: false,
      previousRole,
      newRole,
    };
  }

  const now = Date.now();
  await ctx.db.patch(targetUser._id, {
    role: newRole,
    updatedAt: now,
  });

  await ctx.db.insert("userRoleChangeLogs", {
    targetUserId: targetUser._id,
    actorUserId: args.actor._id,
    previousRole,
    newRole,
    reason: args.reason,
    createdAt: now,
  });

  await ctx.db.insert("userActivityEvents", {
    targetUserId: targetUser._id,
    actorUserId: args.actor._id,
    eventType: "role_changed",
    metadataJson: JSON.stringify({
      previousRole,
      newRole,
      reason: args.reason,
    }),
    createdAt: now,
  });

  if (args.notifyUser) {
    await insertNotification(ctx, {
      recipientUserId: targetUser._id,
      type: "role_changed",
      title: "Account Role Updated",
      message: `Your account role changed from ${previousRole} to ${newRole}.`,
      metadata: {
        previousRole,
        newRole,
        changedAt: now,
      },
    });
  }

  return {
    changed: true,
    previousRole,
    newRole,
  };
}

async function updateUserStatusInternal(
  ctx: MutationCtx,
  args: {
    actor: Doc<"users">;
    targetUserId: Id<"users">;
    nextStatus: UserStatus;
    reason: string;
    durationUntil?: number;
    internalNotes?: string;
    notifyUser: boolean;
  }
): Promise<{ changed: boolean; previousStatus: UserStatus; newStatus: UserStatus }> {
  const targetUser = await ctx.db.get(args.targetUserId);
  if (!targetUser) {
    throw new Error("Target user was not found.");
  }

  const previousStatus = inferUserStatus(targetUser);
  const newStatus = args.nextStatus;

  if (args.actor._id === targetUser._id && newStatus !== "active") {
    throw new Error("You cannot suspend or ban your own account.");
  }

  if (previousStatus === newStatus) {
    return {
      changed: false,
      previousStatus,
      newStatus,
    };
  }

  const now = Date.now();

  await ctx.db.patch(targetUser._id, {
    status: newStatus,
    statusUpdatedAt: now,
    updatedAt: now,
    suspendedReason: newStatus === "suspended" ? args.reason : undefined,
    suspendedUntil: newStatus === "suspended" ? args.durationUntil : undefined,
    suspensionNotes: newStatus === "suspended" ? args.internalNotes : undefined,
    suspensionUpdatedBy: newStatus === "suspended" ? args.actor._id : undefined,
  });

  await ctx.db.insert("userStatusHistory", {
    targetUserId: targetUser._id,
    actorUserId: args.actor._id,
    previousStatus,
    newStatus,
    reason: args.reason,
    durationUntil: args.durationUntil,
    internalNotes: args.internalNotes,
    createdAt: now,
  });

  await ctx.db.insert("userActivityEvents", {
    targetUserId: targetUser._id,
    actorUserId: args.actor._id,
    eventType: "status_changed",
    metadataJson: JSON.stringify({
      previousStatus,
      newStatus,
      reason: args.reason,
      durationUntil: args.durationUntil,
    }),
    createdAt: now,
  });

  if (args.notifyUser) {
    const notificationType =
      newStatus === "active"
        ? "account_reactivated"
        : newStatus === "suspended"
          ? "account_suspended"
          : newStatus === "banned"
            ? "account_banned"
            : "account_pending_verification";

    const notificationMessage =
      newStatus === "active"
        ? "Your account is active again."
        : newStatus === "suspended"
          ? "Your account has been suspended."
          : newStatus === "banned"
            ? "Your account has been banned."
            : "Your account is pending verification.";

    await insertNotification(ctx, {
      recipientUserId: targetUser._id,
      type: notificationType,
      title: "Account Status Updated",
      message: notificationMessage,
      metadata: {
        previousStatus,
        newStatus,
        changedAt: now,
        durationUntil: args.durationUntil,
      },
    });
  }

  return {
    changed: true,
    previousStatus,
    newStatus,
  };
}

export const updateUserRole = mutation({
  args: {
    targetUserId: v.id("users"),
    nextRole: v.union(v.literal("admin"), v.literal("cadet")),
    reason: v.string(),
    notifyUser: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const actor = await requireAdminUser(ctx, "Administrator access is required.");

    const reason = normalizeRequiredText(args.reason, "Reason", MAX_REASON_LENGTH);

    const result = await updateUserRoleInternal(ctx, {
      actor,
      targetUserId: args.targetUserId,
      nextRole: args.nextRole,
      reason,
      notifyUser: args.notifyUser === true,
    });

    return {
      targetUserId: args.targetUserId,
      changed: result.changed,
      previousRole: result.previousRole,
      newRole: result.newRole,
      changedAt: Date.now(),
    };
  },
});

export const updateUserStatus = mutation({
  args: {
    targetUserId: v.id("users"),
    nextStatus: v.union(
      v.literal("active"),
      v.literal("suspended"),
      v.literal("banned"),
      v.literal("pending_verification")
    ),
    reason: v.string(),
    durationUntil: v.optional(v.number()),
    internalNotes: v.optional(v.string()),
    notifyUser: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const actor = await requireAdminUser(ctx, "Administrator access is required.");

    const reason = normalizeRequiredText(args.reason, "Reason", MAX_REASON_LENGTH);
    const internalNotes = normalizeOptionalText(args.internalNotes, MAX_NOTES_LENGTH);

    if (args.nextStatus === "suspended" && typeof args.durationUntil === "number") {
      if (!Number.isFinite(args.durationUntil) || args.durationUntil <= Date.now()) {
        throw new Error("Suspension duration must be a future timestamp.");
      }
    }

    const result = await updateUserStatusInternal(ctx, {
      actor,
      targetUserId: args.targetUserId,
      nextStatus: args.nextStatus,
      reason,
      durationUntil: args.durationUntil,
      internalNotes,
      notifyUser: args.notifyUser === true,
    });

    return {
      targetUserId: args.targetUserId,
      changed: result.changed,
      previousStatus: result.previousStatus,
      newStatus: result.newStatus,
      changedAt: Date.now(),
    };
  },
});

export const addUserAdminNote = mutation({
  args: {
    targetUserId: v.id("users"),
    note: v.string(),
    isPinned: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const actor = await requireAdminUser(ctx, "Administrator access is required.");

    const targetUser = await ctx.db.get(args.targetUserId);
    if (!targetUser) {
      throw new Error("Target user was not found.");
    }

    const note = normalizeRequiredText(args.note, "Note", MAX_NOTES_LENGTH);
    const now = Date.now();

    const noteId = await ctx.db.insert("userAdminNotes", {
      targetUserId: args.targetUserId,
      authorUserId: actor._id,
      note,
      isPinned: args.isPinned === true,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("userActivityEvents", {
      targetUserId: args.targetUserId,
      actorUserId: actor._id,
      eventType: "admin_note_added",
      metadataJson: JSON.stringify({
        noteId,
        isPinned: args.isPinned === true,
      }),
      createdAt: now,
    });

    return {
      noteId,
      targetUserId: args.targetUserId,
      createdAt: now,
    };
  },
});

export const bulkManageUsers = mutation({
  args: {
    targetUserIds: v.array(v.id("users")),
    operation: v.union(v.literal("set_role"), v.literal("set_status")),
    nextRole: v.optional(v.union(v.literal("admin"), v.literal("cadet"))),
    nextStatus: v.optional(
      v.union(
        v.literal("active"),
        v.literal("suspended"),
        v.literal("banned"),
        v.literal("pending_verification")
      )
    ),
    reason: v.string(),
    durationUntil: v.optional(v.number()),
    internalNotes: v.optional(v.string()),
    notifyUser: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const actor = await requireAdminUser(ctx, "Administrator access is required.");

    const reason = normalizeRequiredText(args.reason, "Reason", MAX_REASON_LENGTH);
    const internalNotes = normalizeOptionalText(args.internalNotes, MAX_NOTES_LENGTH);

    if (args.targetUserIds.length === 0) {
      throw new Error("At least one target user is required.");
    }

    if (args.targetUserIds.length > 200) {
      throw new Error("Bulk actions are limited to 200 users per request.");
    }

    if (args.operation === "set_role" && !args.nextRole) {
      throw new Error("nextRole is required for set_role operations.");
    }

    if (args.operation === "set_status" && !args.nextStatus) {
      throw new Error("nextStatus is required for set_status operations.");
    }

    const uniqueTargetIds = Array.from(
      new Set(args.targetUserIds.map((id) => id.toString()))
    );

    const summary = {
      processed: 0,
      changed: 0,
      failed: 0,
      failures: [] as Array<{ targetUserId: string; reason: string }>,
    };

    for (const targetUserIdValue of uniqueTargetIds) {
      const targetUserId = targetUserIdValue as Id<"users">;
      summary.processed += 1;

      try {
        if (args.operation === "set_role") {
          const roleResult = await updateUserRoleInternal(ctx, {
            actor,
            targetUserId,
            nextRole: args.nextRole!,
            reason,
            notifyUser: args.notifyUser === true,
          });

          if (roleResult.changed) {
            summary.changed += 1;
          }

          continue;
        }

        const statusResult = await updateUserStatusInternal(ctx, {
          actor,
          targetUserId,
          nextStatus: args.nextStatus!,
          reason,
          durationUntil: args.durationUntil,
          internalNotes,
          notifyUser: args.notifyUser === true,
        });

        if (statusResult.changed) {
          summary.changed += 1;
        }
      } catch (error) {
        summary.failed += 1;
        const reasonMessage = error instanceof Error ? error.message : "Unknown failure.";
        summary.failures.push({
          targetUserId: targetUserIdValue,
          reason: reasonMessage,
        });
      }
    }

    return {
      ...summary,
      operation: args.operation,
      generatedAt: Date.now(),
    };
  },
});
