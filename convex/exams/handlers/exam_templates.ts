import { mutation, query } from "../../_generated/server";
import { v } from "convex/values";

import { getAuthenticatedUser } from "../services/auth";
import { insertAdminActionLog } from "../services/admin_action_logs";

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

function validateTemplateInput(input: {
  name: string;
  description?: string;
  settings: {
    examEnabled: boolean;
    questionCount: number;
    passThreshold: number;
    availabilityWindow: {
      startDate: string;
      endDate: string;
      startTime: string;
      endTime: string;
      timeZone?: string;
    };
    maxRetakes: number;
    retakeCooldownHours: number;
  };
}): void {
  const name = input.name.trim();
  if (name.length < 2 || name.length > 80) {
    throw new Error("Template name must be between 2 and 80 characters.");
  }

  if (input.description && input.description.length > 300) {
    throw new Error("Template description must be 300 characters or less.");
  }

  if (
    !Number.isInteger(input.settings.questionCount) ||
    input.settings.questionCount < 4 ||
    input.settings.questionCount > 200
  ) {
    throw new Error("questionCount must be an integer between 4 and 200.");
  }

  if (
    !Number.isInteger(input.settings.passThreshold) ||
    input.settings.passThreshold < 1 ||
    input.settings.passThreshold > 100
  ) {
    throw new Error("passThreshold must be an integer between 1 and 100.");
  }

  if (!DATE_REGEX.test(input.settings.availabilityWindow.startDate)) {
    throw new Error("availabilityWindow.startDate must use YYYY-MM-DD format.");
  }

  if (!DATE_REGEX.test(input.settings.availabilityWindow.endDate)) {
    throw new Error("availabilityWindow.endDate must use YYYY-MM-DD format.");
  }

  if (!TIME_REGEX.test(input.settings.availabilityWindow.startTime)) {
    throw new Error("availabilityWindow.startTime must use HH:mm format.");
  }

  if (!TIME_REGEX.test(input.settings.availabilityWindow.endTime)) {
    throw new Error("availabilityWindow.endTime must use HH:mm format.");
  }

  if (
    !Number.isInteger(input.settings.maxRetakes) ||
    input.settings.maxRetakes < 0 ||
    input.settings.maxRetakes > 20
  ) {
    throw new Error("maxRetakes must be an integer between 0 and 20.");
  }

  if (
    !Number.isInteger(input.settings.retakeCooldownHours) ||
    input.settings.retakeCooldownHours < 0 ||
    input.settings.retakeCooldownHours > 24 * 30
  ) {
    throw new Error("retakeCooldownHours must be an integer between 0 and 720.");
  }

  if (
    input.settings.availabilityWindow.timeZone &&
    input.settings.availabilityWindow.timeZone.length > 100
  ) {
    throw new Error("availabilityWindow.timeZone must be 100 characters or less.");
  }
}

export const listAdminExamTemplates = query({
  args: {
    includeArchived: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user || user.role !== "admin") {
      return null;
    }

    const includeArchived = args.includeArchived === true;
    const templates = await ctx.db
      .query("examTemplates")
      .withIndex("by_updatedAt")
      .order("desc")
      .collect();

    if (includeArchived) {
      return templates;
    }

    return templates.filter((template) => template.archivedAt === undefined);
  },
});

export const createAdminExamTemplate = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    settings: v.object({
      examEnabled: v.boolean(),
      questionCount: v.number(),
      passThreshold: v.number(),
      availabilityWindow: v.object({
        startDate: v.string(),
        endDate: v.string(),
        startTime: v.string(),
        endTime: v.string(),
        timeZone: v.optional(v.string()),
      }),
      maxRetakes: v.number(),
      retakeCooldownHours: v.number(),
    }),
  },
  handler: async (ctx, args) => {
    const adminUser = await getAuthenticatedUser(ctx);
    if (!adminUser || adminUser.role !== "admin") {
      throw new Error("Administrator access is required.");
    }

    validateTemplateInput(args);

    const now = Date.now();
    const templateId = await ctx.db.insert("examTemplates", {
      name: args.name.trim(),
      description: args.description?.trim() || undefined,
      settings: {
        ...args.settings,
        questionCount: Math.round(args.settings.questionCount),
        passThreshold: Math.round(args.settings.passThreshold),
        maxRetakes: Math.round(args.settings.maxRetakes),
        retakeCooldownHours: Math.round(args.settings.retakeCooldownHours),
        availabilityWindow: {
          ...args.settings.availabilityWindow,
          timeZone: args.settings.availabilityWindow.timeZone?.trim() || undefined,
        },
      },
      updatedBy: adminUser._id,
      createdAt: now,
      updatedAt: now,
    });

    await insertAdminActionLog(ctx, {
      actorUser: adminUser,
      actionType: "exam_template_created",
      targetType: "exam_template",
      targetId: String(templateId),
      message: "Created exam configuration template.",
      metadata: {
        templateName: args.name.trim(),
      },
    });

    return ctx.db.get(templateId);
  },
});

export const updateAdminExamTemplate = mutation({
  args: {
    templateId: v.id("examTemplates"),
    name: v.string(),
    description: v.optional(v.string()),
    settings: v.object({
      examEnabled: v.boolean(),
      questionCount: v.number(),
      passThreshold: v.number(),
      availabilityWindow: v.object({
        startDate: v.string(),
        endDate: v.string(),
        startTime: v.string(),
        endTime: v.string(),
        timeZone: v.optional(v.string()),
      }),
      maxRetakes: v.number(),
      retakeCooldownHours: v.number(),
    }),
  },
  handler: async (ctx, args) => {
    const adminUser = await getAuthenticatedUser(ctx);
    if (!adminUser || adminUser.role !== "admin") {
      throw new Error("Administrator access is required.");
    }

    validateTemplateInput(args);

    const existing = await ctx.db.get(args.templateId);
    if (!existing) {
      throw new Error("Template was not found.");
    }

    const now = Date.now();
    await ctx.db.patch(args.templateId, {
      name: args.name.trim(),
      description: args.description?.trim() || undefined,
      settings: {
        ...args.settings,
        questionCount: Math.round(args.settings.questionCount),
        passThreshold: Math.round(args.settings.passThreshold),
        maxRetakes: Math.round(args.settings.maxRetakes),
        retakeCooldownHours: Math.round(args.settings.retakeCooldownHours),
        availabilityWindow: {
          ...args.settings.availabilityWindow,
          timeZone: args.settings.availabilityWindow.timeZone?.trim() || undefined,
        },
      },
      updatedBy: adminUser._id,
      updatedAt: now,
      archivedAt: undefined,
      archivedBy: undefined,
    });

    await insertAdminActionLog(ctx, {
      actorUser: adminUser,
      actionType: "exam_template_updated",
      targetType: "exam_template",
      targetId: String(args.templateId),
      message: "Updated exam configuration template.",
      metadata: {
        templateName: args.name.trim(),
      },
    });

    return ctx.db.get(args.templateId);
  },
});

export const archiveAdminExamTemplate = mutation({
  args: {
    templateId: v.id("examTemplates"),
  },
  handler: async (ctx, args) => {
    const adminUser = await getAuthenticatedUser(ctx);
    if (!adminUser || adminUser.role !== "admin") {
      throw new Error("Administrator access is required.");
    }

    const existing = await ctx.db.get(args.templateId);
    if (!existing) {
      throw new Error("Template was not found.");
    }

    if (existing.archivedAt !== undefined) {
      return existing;
    }

    const now = Date.now();
    await ctx.db.patch(args.templateId, {
      archivedAt: now,
      archivedBy: adminUser._id,
      updatedBy: adminUser._id,
      updatedAt: now,
    });

    await insertAdminActionLog(ctx, {
      actorUser: adminUser,
      actionType: "exam_template_archived",
      targetType: "exam_template",
      targetId: String(args.templateId),
      message: "Archived exam configuration template.",
      metadata: {
        templateName: existing.name,
      },
    });

    return ctx.db.get(args.templateId);
  },
});
