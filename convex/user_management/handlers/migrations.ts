import { mutation } from "../../_generated/server";
import { v } from "convex/values";

import { requireAdminUser } from "../../lib/auth";

const DEFAULT_BATCH_LIMIT = 250;
const MAX_BATCH_LIMIT = 2000;
const USER_MANAGEMENT_MIGRATION_V1 = 1;

function resolveBatchLimit(limit?: number): number {
  const resolvedLimit = limit ?? DEFAULT_BATCH_LIMIT;
  if (!Number.isInteger(resolvedLimit) || resolvedLimit < 1 || resolvedLimit > MAX_BATCH_LIMIT) {
    throw new Error(`Limit must be an integer between 1 and ${MAX_BATCH_LIMIT}.`);
  }

  return resolvedLimit;
}

export const backfillUserManagementV1 = mutation({
  args: {
    limit: v.optional(v.number()),
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireAdminUser(ctx, "Only administrators can run user management migrations.");

    const limit = resolveBatchLimit(args.limit);
    const dryRun = args.dryRun ?? false;

    const users = await ctx.db
      .query("users")
      .withIndex("by_createdAt")
      .order("asc")
      .take(limit);

    let updatedCount = 0;

    for (const user of users) {
      if (user.userManagementMigrationVersion === USER_MANAGEMENT_MIGRATION_V1) {
        continue;
      }

      const fallbackStatusUpdatedAt = user.updatedAt ?? user.createdAt;
      const fallbackLastActiveAt = user.updatedAt ?? user.createdAt;

      if (!dryRun) {
        await ctx.db.patch(user._id, {
          status: user.status ?? "active",
          statusUpdatedAt: user.statusUpdatedAt ?? fallbackStatusUpdatedAt,
          lastActiveAt: user.lastActiveAt ?? fallbackLastActiveAt,
          isFlaggedForReview: user.isFlaggedForReview ?? false,
          userManagementMigrationVersion: USER_MANAGEMENT_MIGRATION_V1,
        });
      }

      updatedCount += 1;
    }

    return {
      migrationVersion: USER_MANAGEMENT_MIGRATION_V1,
      scanned: users.length,
      updated: updatedCount,
      skipped: users.length - updatedCount,
      dryRun,
      generatedAt: Date.now(),
    };
  },
});

export const rollbackUserManagementV1 = mutation({
  args: {
    limit: v.optional(v.number()),
    dryRun: v.optional(v.boolean()),
    confirmation: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAdminUser(ctx, "Only administrators can rollback user management migrations.");

    if (args.confirmation !== "ROLLBACK_USER_MANAGEMENT_V1") {
      throw new Error("Invalid confirmation token for rollback.");
    }

    const limit = resolveBatchLimit(args.limit);
    const dryRun = args.dryRun ?? false;

    const users = await ctx.db
      .query("users")
      .withIndex("by_createdAt")
      .order("asc")
      .take(limit);

    const targetUsers = users.filter(
      (user) => user.userManagementMigrationVersion === USER_MANAGEMENT_MIGRATION_V1
    );

    if (!dryRun) {
      for (const user of targetUsers) {
        await ctx.db.patch(user._id, {
          status: undefined,
          statusUpdatedAt: undefined,
          lastActiveAt: undefined,
          isFlaggedForReview: undefined,
          userManagementMigrationVersion: undefined,
        });
      }
    }

    return {
      migrationVersion: USER_MANAGEMENT_MIGRATION_V1,
      scanned: users.length,
      rolledBack: targetUsers.length,
      skipped: users.length - targetUsers.length,
      dryRun,
      generatedAt: Date.now(),
    };
  },
});
