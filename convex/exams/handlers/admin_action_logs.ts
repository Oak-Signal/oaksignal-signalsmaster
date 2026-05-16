import { query } from "../../_generated/server";
import { v } from "convex/values";

import { getAuthenticatedUser } from "../services/auth";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

function normalizePage(value: number | undefined): number {
  if (!value || !Number.isInteger(value) || value < 1) {
    return DEFAULT_PAGE;
  }
  return value;
}

function normalizeLimit(value: number | undefined): number {
  if (!value || !Number.isInteger(value) || value < 1) {
    return DEFAULT_LIMIT;
  }
  return Math.min(value, MAX_LIMIT);
}

function normalizeQueryText(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : undefined;
}

export const getAdminActionLogs = query({
  args: {
    page: v.optional(v.number()),
    limit: v.optional(v.number()),
    actionType: v.optional(
      v.union(
        v.literal("system_config_updated"),
        v.literal("maintenance_mode_enabled"),
        v.literal("maintenance_mode_disabled"),
        v.literal("exam_template_created"),
        v.literal("exam_template_updated"),
        v.literal("exam_template_archived")
      )
    ),
    targetType: v.optional(v.union(v.literal("system_config"), v.literal("exam_template"))),
    outcome: v.optional(v.union(v.literal("success"), v.literal("failure"))),
    fromMs: v.optional(v.number()),
    toMs: v.optional(v.number()),
    queryText: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user || user.role !== "admin") {
      return null;
    }

    const page = normalizePage(args.page);
    const limit = normalizeLimit(args.limit);
    const offset = (page - 1) * limit;

    const fromMs =
      typeof args.fromMs === "number" && Number.isFinite(args.fromMs)
        ? args.fromMs
        : undefined;
    const toMs =
      typeof args.toMs === "number" && Number.isFinite(args.toMs)
        ? args.toMs
        : undefined;

    let records =
      fromMs !== undefined
        ? await ctx.db
            .query("adminActionLogs")
            .withIndex("by_createdAt", (q) => q.gte("createdAt", fromMs))
            .order("desc")
            .collect()
        : await ctx.db
            .query("adminActionLogs")
            .withIndex("by_createdAt")
            .order("desc")
            .collect();

    if (toMs !== undefined) {
      records = records.filter((item) => item.createdAt <= toMs);
    }

    if (args.actionType) {
      records = records.filter((item) => item.actionType === args.actionType);
    }

    if (args.targetType) {
      records = records.filter((item) => item.targetType === args.targetType);
    }

    if (args.outcome) {
      records = records.filter((item) => item.outcome === args.outcome);
    }

    const normalizedQueryText = normalizeQueryText(args.queryText);
    if (normalizedQueryText) {
      records = records.filter((item) => {
        const metadataText = item.metadataJson?.toLowerCase() ?? "";
        const messageText = item.message.toLowerCase();
        const targetIdText = item.targetId?.toLowerCase() ?? "";
        return (
          messageText.includes(normalizedQueryText) ||
          metadataText.includes(normalizedQueryText) ||
          targetIdText.includes(normalizedQueryText)
        );
      });
    }

    const paged = records.slice(offset, offset + limit);

    const actorUsersById = new Map<string, { name: string; email: string }>();
    for (const record of paged) {
      const actorUserId = record.actorUserId.toString();
      if (actorUsersById.has(actorUserId)) {
        continue;
      }

      const actor = await ctx.db.get(record.actorUserId);
      actorUsersById.set(actorUserId, {
        name: actor?.name?.trim() || actor?.email || "Unknown",
        email: actor?.email || "unknown@example.com",
      });
    }

    return {
      items: paged.map((record) => {
        const actor = actorUsersById.get(record.actorUserId.toString());
        return {
          ...record,
          actorDisplayName: actor?.name ?? "Unknown",
          actorEmail: actor?.email ?? "unknown@example.com",
        };
      }),
      pagination: {
        page,
        limit,
        totalCount: records.length,
        totalPages: records.length === 0 ? 0 : Math.ceil(records.length / limit),
      },
      generatedAt: Date.now(),
    };
  },
});
