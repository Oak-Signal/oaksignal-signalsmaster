import { Doc, Id } from "../../_generated/dataModel";
import { MutationCtx, QueryCtx } from "../../_generated/server";

type PracticeCtx = QueryCtx | MutationCtx;

export async function selectRandomFlags(
  ctx: PracticeCtx,
  count: number | "all"
): Promise<Id<"flags">[]> {
  const allFlags = await ctx.db.query("flags").withIndex("by_order").collect();

  if (allFlags.length === 0) {
    throw new Error("No flags available in database");
  }

  if (count === "all") {
    return allFlags.map((flag: Doc<"flags">) => flag._id);
  }

  const actualCount = Math.min(count, allFlags.length);
  const shuffled = [...allFlags];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled.slice(0, actualCount).map((flag: Doc<"flags">) => flag._id);
}

export async function fetchFlagsForGeneration(
  ctx: PracticeCtx,
  flagIds: Id<"flags">[]
): Promise<Doc<"flags">[]> {
  const flags: Doc<"flags">[] = [];

  for (const flagId of flagIds) {
    const flag = await ctx.db.get(flagId);
    if (!flag) {
      throw new Error(`Flag with ID ${flagId} not found`);
    }
    flags.push(flag);
  }

  return flags;
}
