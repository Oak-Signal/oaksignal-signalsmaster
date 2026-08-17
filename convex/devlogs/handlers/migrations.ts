import { internalMutation } from "../../_generated/server";
import { Doc } from "../../_generated/dataModel";
import { DEVLOG_SEED_DATA } from "../../seed/devlogs";

type DevlogStage = Doc<"devlogs">["stage"];

// Idempotency is keyed by `title` (not `version`) because the legacy Markdown data has several
// entries sharing the same `version` value (a release bucket, not a per-entry ID) — see the
// header comment in `convex/seed/devlogs.ts`.
export const seedDevlogsFromMarkdown = internalMutation({
  args: {},
  handler: async (ctx) => {
    let created = 0;
    let updated = 0;

    for (const entry of DEVLOG_SEED_DATA) {
      const existing = await ctx.db
        .query("devlogs")
        .filter((q) => q.eq(q.field("title"), entry.title))
        .first();

      const now = Date.now();

      if (existing) {
        await ctx.db.patch(existing._id, {
          ...entry,
          stage: entry.stage as DevlogStage,
          updatedAt: now,
        });
        updated++;
      } else {
        await ctx.db.insert("devlogs", {
          ...entry,
          stage: entry.stage as DevlogStage,
          createdAt: now,
          updatedAt: now,
        });
        created++;
      }
    }

    return {
      success: true,
      message: `Devlogs seeded successfully. Created: ${created}, Updated: ${updated}`,
    };
  },
});
