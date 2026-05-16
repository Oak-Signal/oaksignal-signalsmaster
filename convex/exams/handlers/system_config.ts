import { mutation, query } from "../../_generated/server";
import { v } from "convex/values";

import { Id } from "../../_generated/dataModel";
import { getAuthenticatedUser } from "../services/auth";
import { insertAdminActionLog } from "../services/admin_action_logs";

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const DEFAULT_SYSTEM_CONFIG = {
  configKey: "global",
  examEnabled: true,
  questionCount: 50,
  passThreshold: 80,
  availabilityWindow: {
    startDate: "2025-01-01",
    endDate: "2025-12-31",
    startTime: "08:00",
    endTime: "20:00",
    timeZone: "UTC",
  },
  maxRetakes: 3,
  retakeCooldownHours: 24,
  maintenanceModeEnabled: false,
  maintenanceMessage: undefined,
} as const;

function validateDateText(value: string, label: string): void {
  if (!DATE_REGEX.test(value)) {
    throw new Error(`${label} must use YYYY-MM-DD format.`);
  }

  const parsed = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${label} is not a valid date.`);
  }
}

function validateTimeText(value: string, label: string): void {
  if (!TIME_REGEX.test(value)) {
    throw new Error(`${label} must use HH:mm (24-hour) format.`);
  }
}

function validateSystemConfigInput(input: {
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
  maintenanceMessage?: string;
}): void {
  if (!Number.isInteger(input.questionCount) || input.questionCount < 4 || input.questionCount > 200) {
    throw new Error("questionCount must be an integer between 4 and 200.");
  }

  if (!Number.isInteger(input.passThreshold) || input.passThreshold < 1 || input.passThreshold > 100) {
    throw new Error("passThreshold must be an integer between 1 and 100.");
  }

  validateDateText(input.availabilityWindow.startDate, "availabilityWindow.startDate");
  validateDateText(input.availabilityWindow.endDate, "availabilityWindow.endDate");
  validateTimeText(input.availabilityWindow.startTime, "availabilityWindow.startTime");
  validateTimeText(input.availabilityWindow.endTime, "availabilityWindow.endTime");

  const startDateMs = Date.parse(`${input.availabilityWindow.startDate}T00:00:00.000Z`);
  const endDateMs = Date.parse(`${input.availabilityWindow.endDate}T00:00:00.000Z`);
  if (startDateMs > endDateMs) {
    throw new Error("availabilityWindow.startDate must be before or equal to availabilityWindow.endDate.");
  }

  if (!Number.isInteger(input.maxRetakes) || input.maxRetakes < 0 || input.maxRetakes > 20) {
    throw new Error("maxRetakes must be an integer between 0 and 20.");
  }

  if (
    !Number.isInteger(input.retakeCooldownHours) ||
    input.retakeCooldownHours < 0 ||
    input.retakeCooldownHours > 24 * 30
  ) {
    throw new Error("retakeCooldownHours must be an integer between 0 and 720.");
  }

  if (input.maintenanceMessage && input.maintenanceMessage.length > 500) {
    throw new Error("maintenanceMessage must be 500 characters or less.");
  }

  if (input.availabilityWindow.timeZone && input.availabilityWindow.timeZone.length > 100) {
    throw new Error("availabilityWindow.timeZone must be 100 characters or less.");
  }
}

export const getAdminSystemConfig = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user || user.role !== "admin") {
      return null;
    }

    const current = await ctx.db
      .query("systemConfig")
      .withIndex("by_configKey", (q) => q.eq("configKey", DEFAULT_SYSTEM_CONFIG.configKey))
      .unique();

    if (!current) {
      return {
        ...DEFAULT_SYSTEM_CONFIG,
        updatedBy: user._id,
        updatedAt: null,
        createdAt: null,
      };
    }

    return current;
  },
});

export const upsertAdminSystemConfig = mutation({
  args: {
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
    maintenanceModeEnabled: v.boolean(),
    maintenanceMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const adminUser = await getAuthenticatedUser(ctx);
    if (!adminUser || adminUser.role !== "admin") {
      throw new Error("Administrator access is required.");
    }

    validateSystemConfigInput({
      questionCount: args.questionCount,
      passThreshold: args.passThreshold,
      availabilityWindow: args.availabilityWindow,
      maxRetakes: args.maxRetakes,
      retakeCooldownHours: args.retakeCooldownHours,
      maintenanceMessage: args.maintenanceMessage,
    });

    const now = Date.now();
    const maintenanceMessage = args.maintenanceMessage?.trim() || undefined;

    const existing = await ctx.db
      .query("systemConfig")
      .withIndex("by_configKey", (q) => q.eq("configKey", DEFAULT_SYSTEM_CONFIG.configKey))
      .unique();

    const payload = {
      configKey: DEFAULT_SYSTEM_CONFIG.configKey,
      examEnabled: args.examEnabled,
      questionCount: Math.round(args.questionCount),
      passThreshold: Math.round(args.passThreshold),
      availabilityWindow: {
        startDate: args.availabilityWindow.startDate,
        endDate: args.availabilityWindow.endDate,
        startTime: args.availabilityWindow.startTime,
        endTime: args.availabilityWindow.endTime,
        timeZone: args.availabilityWindow.timeZone?.trim() || undefined,
      },
      maxRetakes: Math.round(args.maxRetakes),
      retakeCooldownHours: Math.round(args.retakeCooldownHours),
      maintenanceModeEnabled: args.maintenanceModeEnabled,
      maintenanceMessage,
      updatedBy: adminUser._id,
      updatedAt: now,
    };

    let savedId: Id<"systemConfig">;
    if (existing) {
      await ctx.db.patch(existing._id, payload);
      savedId = existing._id;
    } else {
      savedId = await ctx.db.insert("systemConfig", {
        ...payload,
        createdAt: now,
      });
    }

    await insertAdminActionLog(ctx, {
      actorUser: adminUser,
      actionType: args.maintenanceModeEnabled ? "maintenance_mode_enabled" : "maintenance_mode_disabled",
      targetType: "system_config",
      targetId: String(savedId),
      message: args.maintenanceModeEnabled
        ? "Enabled maintenance mode via system configuration update."
        : "Updated system configuration.",
      metadata: {
        examEnabled: args.examEnabled,
        questionCount: args.questionCount,
        passThreshold: args.passThreshold,
        maxRetakes: args.maxRetakes,
        retakeCooldownHours: args.retakeCooldownHours,
      },
    });

    await insertAdminActionLog(ctx, {
      actorUser: adminUser,
      actionType: "system_config_updated",
      targetType: "system_config",
      targetId: String(savedId),
      message: "Updated exam system configuration.",
      metadata: {
        examEnabled: args.examEnabled,
        maintenanceModeEnabled: args.maintenanceModeEnabled,
      },
    });

    const saved = await ctx.db.get(savedId);
    if (!saved) {
      throw new Error("System configuration could not be loaded after save.");
    }

    return saved;
  },
});
