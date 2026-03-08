import { Doc } from "../../_generated/dataModel";
import { MutationCtx } from "../../_generated/server";
import { getQuestionResponseTimeMs } from "./time";

export async function buildQuestionBreakdownFromAttempt(
  ctx: MutationCtx,
  input: {
    attempt: Doc<"examAttempts">;
    sortedQuestions: Doc<"examQuestions">[];
  }
): Promise<Array<{
  questionIndex: number;
  flagId: Doc<"flags">["_id"];
  flagKey: string;
  flagName: string;
  flagImagePath: string;
  category: string;
  mode: "learn" | "match";
  options: Array<{
    id: string;
    label: string;
    value: string;
    imagePath?: string;
  }>;
  selectedAnswer: string | null;
  correctAnswer: string;
  isCorrect: boolean;
  answeredAt?: number;
  responseTimeMs?: number;
  questionChecksum: string;
}>> {
  const flagSnapshotById = new Map(
    (input.attempt.flagSnapshot ?? []).map((item) => [item.flagId, item])
  );

  const questionBreakdown: Array<{
    questionIndex: number;
    flagId: Doc<"flags">["_id"];
    flagKey: string;
    flagName: string;
    flagImagePath: string;
    category: string;
    mode: "learn" | "match";
    options: Array<{
      id: string;
      label: string;
      value: string;
      imagePath?: string;
    }>;
    selectedAnswer: string | null;
    correctAnswer: string;
    isCorrect: boolean;
    answeredAt?: number;
    responseTimeMs?: number;
    questionChecksum: string;
  }> = [];

  for (let index = 0; index < input.sortedQuestions.length; index += 1) {
    const question = input.sortedQuestions[index];
    const snapshotFlag = flagSnapshotById.get(question.flagId);
    const fallbackFlag = snapshotFlag ? null : await ctx.db.get(question.flagId);

    questionBreakdown.push({
      questionIndex: question.questionIndex,
      flagId: question.flagId,
      flagKey: question.flagKey,
      flagName: snapshotFlag?.name ?? fallbackFlag?.name ?? question.flagKey,
      flagImagePath: snapshotFlag?.imagePath ?? fallbackFlag?.imagePath ?? "",
      category: snapshotFlag?.category ?? fallbackFlag?.category ?? "unknown",
      mode: question.mode,
      options: question.options,
      selectedAnswer: question.userAnswer,
      correctAnswer: question.correctAnswer,
      isCorrect: question.isCorrect === true,
      answeredAt: question.answeredAt,
      responseTimeMs: getQuestionResponseTimeMs({
        startedAt: input.attempt.startedAt,
        sortedQuestions: input.sortedQuestions,
        index,
      }),
      questionChecksum: question.checksum,
    });
  }

  return questionBreakdown;
}

export function buildCertificateNumber(input: {
  completedAt: number;
  attemptNumber: number;
  examAttemptId: string;
}): string {
  const date = new Date(input.completedAt);
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const compactAttemptId = input.examAttemptId
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(-8)
    .toUpperCase();
  return `OSM-${yyyy}${mm}${dd}-${String(input.attemptNumber).padStart(3, "0")}-${compactAttemptId}`;
}

export function buildCompletedExamStats(
  questions: Doc<"examQuestions">[],
  attempt: Doc<"examAttempts">
): {
  modeStats: {
    learn: { total: number; correct: number; incorrect: number };
    match: { total: number; correct: number; incorrect: number };
  };
  categoryStats: Array<{
    category: string;
    total: number;
    correct: number;
    incorrect: number;
  }>;
} {
  const modeStats = {
    learn: { total: 0, correct: 0, incorrect: 0 },
    match: { total: 0, correct: 0, incorrect: 0 },
  };

  const categoryByFlagId = new Map<string, string>();
  for (const item of attempt.flagSnapshot ?? []) {
    categoryByFlagId.set(item.flagId, item.category);
  }

  const categoryTally = new Map<
    string,
    { total: number; correct: number; incorrect: number }
  >();

  for (const question of questions) {
    const correct = question.isCorrect === true;
    const modeBucket = modeStats[question.mode];
    modeBucket.total += 1;
    if (correct) {
      modeBucket.correct += 1;
    } else {
      modeBucket.incorrect += 1;
    }

    const category = categoryByFlagId.get(question.flagId) ?? "unknown";
    const existing = categoryTally.get(category) ?? {
      total: 0,
      correct: 0,
      incorrect: 0,
    };
    existing.total += 1;
    if (correct) {
      existing.correct += 1;
    } else {
      existing.incorrect += 1;
    }
    categoryTally.set(category, existing);
  }

  const categoryStats = [...categoryTally.entries()]
    .map(([category, tally]) => ({
      category,
      total: tally.total,
      correct: tally.correct,
      incorrect: tally.incorrect,
    }))
    .sort((a, b) => a.category.localeCompare(b.category));

  return {
    modeStats,
    categoryStats,
  };
}
