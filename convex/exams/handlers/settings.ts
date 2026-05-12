import { query } from "../../_generated/server";
import { getAuthenticatedUser } from "../services/auth";
import {
  resolveExamGenerationSettings,
  resolveExamIntegrityThresholds,
} from "../services/query_helpers";

export const getExamGenerationSettings = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user) {
      return null;
    }

    if (user.role !== "admin") {
      return null;
    }

    const generationSettings = await resolveExamGenerationSettings(ctx);
    return generationSettings;
  },
});

export const getExamIntegrityThresholds = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user || user.role !== "admin") {
      return null;
    }

    return resolveExamIntegrityThresholds(ctx);
  },
});
