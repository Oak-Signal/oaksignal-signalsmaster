import { v } from "convex/values";
import { query } from "../../_generated/server";

export const listDevlogs = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("devlogs").withIndex("by_date").order("desc").collect();
  },
});

export const listDevlogsByStage = query({
  args: {
    stage: v.union(
      v.literal("all"),
      v.literal("Pre-Alpha"),
      v.literal("Alpha"),
      v.literal("Closed Beta"),
      v.literal("Open Beta"),
      v.literal("Release Candidate"),
      v.literal("General Availability"),
      v.literal("Production")
    ),
  },
  handler: async (ctx, args) => {
    if (args.stage === "all") {
      return await ctx.db.query("devlogs").withIndex("by_date").order("desc").collect();
    }

    const stage = args.stage;
    return await ctx.db
      .query("devlogs")
      .withIndex("by_stage_date", (q) => q.eq("stage", stage))
      .order("desc")
      .collect();
  },
});

export const getDevlogStageCounts = query({
  args: {},
  handler: async (ctx) => {
    const counts: Record<
      | "Pre-Alpha"
      | "Alpha"
      | "Closed Beta"
      | "Open Beta"
      | "Release Candidate"
      | "General Availability"
      | "Production",
      number
    > = {
      "Pre-Alpha": 0,
      Alpha: 0,
      "Closed Beta": 0,
      "Open Beta": 0,
      "Release Candidate": 0,
      "General Availability": 0,
      Production: 0,
    };

    const devlogs = await ctx.db.query("devlogs").collect();
    for (const devlog of devlogs) {
      counts[devlog.stage] += 1;
    }

    return counts;
  },
});
