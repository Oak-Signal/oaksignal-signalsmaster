import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const logAccessAttempt = mutation({
  args: {
    actorUserId: v.optional(v.id("users")),
    actorClerkId: v.optional(v.string()),
    actorRole: v.union(v.literal("cadet"), v.literal("admin"), v.literal("unknown")),
    surface: v.union(v.literal("page"), v.literal("api")),
    target: v.string(),
    method: v.optional(v.string()),
    outcome: v.union(v.literal("allowed"), v.literal("denied")),
    reason: v.optional(v.string()),
    metadataJson: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("adminAccessLogs", {
      actorUserId: args.actorUserId,
      actorClerkId: args.actorClerkId,
      actorRole: args.actorRole,
      surface: args.surface,
      target: args.target,
      method: args.method,
      outcome: args.outcome,
      reason: args.reason,
      metadataJson: args.metadataJson,
      createdAt: Date.now(),
    });
  },
});
