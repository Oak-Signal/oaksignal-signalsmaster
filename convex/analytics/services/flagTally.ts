import { Doc, Id } from "../../_generated/dataModel";

export type FlagTallyRow = {
  flagId: Id<"flags">;
  attempts: number;
  misses: number;
};

export function tallyFlagsFromSessions(
  sessions: Doc<"practiceSessions">[],
  cutoff: number
): FlagTallyRow[] {
  const tally = new Map<string, FlagTallyRow>();

  for (const session of sessions) {
    if (cutoff > 0 && (session.completedAt ?? 0) < cutoff) {
      continue;
    }
    if (!session.questions) {
      continue;
    }

    for (const question of session.questions) {
      const key = question.flagId.toString();
      const existing = tally.get(key) ?? {
        flagId: question.flagId,
        attempts: 0,
        misses: 0,
      };

      existing.attempts += 1;
      if (question.userAnswer !== question.correctAnswer) {
        existing.misses += 1;
      }

      tally.set(key, existing);
    }
  }

  return Array.from(tally.values());
}
