import { v } from "convex/values";
import { mutation } from "../../_generated/server";
import { requireAdminUser } from "../../lib/auth";

const stageArg = v.union(
  v.literal("Pre-Alpha"),
  v.literal("Alpha"),
  v.literal("Closed Beta"),
  v.literal("Open Beta"),
  v.literal("Release Candidate"),
  v.literal("General Availability"),
  v.literal("Production")
);

export const createDevlog = mutation({
  args: {
    version: v.string(),
    date: v.string(),
    title: v.string(),
    stage: stageArg,
    category: v.string(),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdminUser(ctx, "Only administrators can create devlogs.");

    const now = Date.now();
    return await ctx.db.insert("devlogs", {
      version: args.version,
      date: args.date,
      title: args.title,
      stage: args.stage,
      category: args.category,
      body: args.body,
      createdBy: admin._id,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateDevlog = mutation({
  args: {
    devlogId: v.id("devlogs"),
    version: v.string(),
    date: v.string(),
    title: v.string(),
    stage: stageArg,
    category: v.string(),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAdminUser(ctx, "Only administrators can update devlogs.");

    const existing = await ctx.db.get(args.devlogId);
    if (!existing) {
      throw new Error("Devlog not found.");
    }

    await ctx.db.patch(args.devlogId, {
      version: args.version,
      date: args.date,
      title: args.title,
      stage: args.stage,
      category: args.category,
      body: args.body,
      updatedAt: Date.now(),
    });

    return null;
  },
});

export const deleteDevlog = mutation({
  args: {
    devlogId: v.id("devlogs"),
  },
  handler: async (ctx, args) => {
    await requireAdminUser(ctx, "Only administrators can delete devlogs.");

    const existing = await ctx.db.get(args.devlogId);
    if (!existing) {
      throw new Error("Devlog not found.");
    }

    await ctx.db.delete(args.devlogId);
    return null;
  },
});
