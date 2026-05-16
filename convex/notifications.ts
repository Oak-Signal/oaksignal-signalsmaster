import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

import { getAuthenticatedUser } from "./lib/auth";

export const listMyNotifications = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user) {
      return null;
    }

    const limit = args.limit ?? 10;
    if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
      throw new Error("Limit must be an integer between 1 and 50.");
    }

    const rows = await ctx.db
      .query("notifications")
      .withIndex("by_recipient_createdAt", (q) => q.eq("recipientUserId", user._id))
      .order("desc")
      .take(limit);

    const unreadCount = rows.reduce((count, row) => {
      return row.readAt === undefined ? count + 1 : count;
    }, 0);

    return {
      items: rows.map((row) => ({
        notificationId: row._id,
        type: row.type,
        title: row.title,
        message: row.message,
        metadataJson: row.metadataJson,
        readAt: row.readAt,
        createdAt: row.createdAt,
      })),
      unreadCount,
      totalCount: rows.length,
      generatedAt: Date.now(),
    };
  },
});

export const markNotificationRead = mutation({
  args: {
    notificationId: v.id("notifications"),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user) {
      return null;
    }

    const notification = await ctx.db.get(args.notificationId);
    if (!notification || notification.recipientUserId !== user._id) {
      return null;
    }

    if (notification.readAt !== undefined) {
      return {
        success: true,
        readAt: notification.readAt,
      };
    }

    const readAt = Date.now();
    await ctx.db.patch(notification._id, {
      readAt,
    });

    return {
      success: true,
      readAt,
    };
  },
});

export const markAllNotificationsRead = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user) {
      return null;
    }

    const unreadRows = await ctx.db
      .query("notifications")
      .withIndex("by_recipient_readAt", (q) =>
        q.eq("recipientUserId", user._id).eq("readAt", undefined)
      )
      .collect();

    if (unreadRows.length === 0) {
      return {
        success: true,
        updated: 0,
      };
    }

    const readAt = Date.now();
    for (const row of unreadRows) {
      await ctx.db.patch(row._id, { readAt });
    }

    return {
      success: true,
      updated: unreadRows.length,
      readAt,
    };
  },
});
