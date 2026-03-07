import { Doc, Id } from "../_generated/dataModel";
import { rankBySimilarity } from "./flag_similarity";
import {
  buildBalancedAnswerPositions,
  createSeededRandom,
  shuffleWithRandom,
} from "./exam_randomization";
import { buildExamChecksum, buildQuestionChecksum } from "./exam_checksum";
import {
  ExamFlagSnapshotItem,
  ExamGenerationSnapshot,
  ExamModeStrategy,
  ExamQuestionMode,
  ExamQuestionOption,
  ExamQuestionRecord,
} from "./exam_types";

interface ExamGenerationConfig {
  modeStrategy: ExamModeStrategy;
  singleMode?: ExamQuestionMode;
  seed: number;
  generationVersion: number;
}

interface GenerateExamQuestionsResult {
  questions: Omit<
    ExamQuestionRecord,
    "examAttemptId" | "userId" | "userAnswer" | "answeredAt" | "isCorrect" | "createdAt" | "updatedAt"
  >[];
  generationSnapshot: Omit<
    ExamGenerationSnapshot,
    "generationStartedAt" | "generationCompletedAt" | "generationTimeMs" | "generationRetryCount"
  >;
  flagSnapshot: ExamFlagSnapshotItem[];
}

function buildDistractors(
  targetFlag: Doc<"flags">,
  allFlags: Doc<"flags">[],
  mode: ExamQuestionMode,
  random: () => number
): Doc<"flags">[] {
  const ranked = rankBySimilarity(
    targetFlag,
    allFlags,
    mode === "learn" ? "semantic" : "visual"
  ).map(([flag]) => flag);

  const selected: Doc<"flags">[] = [];
  const seenKeys = new Set<string>([targetFlag.key]);

  for (const candidate of ranked) {
    if (candidate.key === targetFlag.key || seenKeys.has(candidate.key)) {
      continue;
    }
    selected.push(candidate);
    seenKeys.add(candidate.key);
    if (selected.length === 3) {
      return selected;
    }
  }

  const fallbackPool = shuffleWithRandom(
    allFlags.filter((flag) => !seenKeys.has(flag.key)),
    random
  );

  for (const candidate of fallbackPool) {
    if (!seenKeys.has(candidate.key)) {
      selected.push(candidate);
      seenKeys.add(candidate.key);
      if (selected.length === 3) {
        break;
      }
    }
  }

  if (selected.length !== 3) {
    throw new Error("Unable to build 3 distractors for exam question generation.");
  }

  return selected;
}

function buildQuestionOptions(input: {
  targetFlag: Doc<"flags">;
  distractors: Doc<"flags">[];
  mode: ExamQuestionMode;
  correctPosition: number;
  random: () => number;
}): { options: ExamQuestionOption[]; correctAnswer: string } {
  const distractors = shuffleWithRandom(input.distractors, input.random);
  const orderedOptions: ExamQuestionOption[] = new Array(4);

  const correctOption: ExamQuestionOption =
    input.mode === "learn"
      ? {
          id: "placeholder",
          label: input.targetFlag.name,
          value: input.targetFlag.key,
        }
      : {
          id: "placeholder",
          label: "",
          value: input.targetFlag.key,
          imagePath: input.targetFlag.imagePath,
        };

  orderedOptions[input.correctPosition] = correctOption;

  let distractorIndex = 0;
  for (let i = 0; i < 4; i++) {
    if (i === input.correctPosition) {
      continue;
    }
    const distractor = distractors[distractorIndex];
    distractorIndex++;

    orderedOptions[i] =
      input.mode === "learn"
        ? {
            id: "placeholder",
            label: distractor.name,
            value: distractor.key,
          }
        : {
            id: "placeholder",
            label: "",
            value: distractor.key,
            imagePath: distractor.imagePath,
          };
  }

  for (let i = 0; i < orderedOptions.length; i++) {
    orderedOptions[i].id = `opt_${i}`;
  }

  return {
    options: orderedOptions,
    correctAnswer: `opt_${input.correctPosition}`,
  };
}

function resolveQuestionMode(
  modeStrategy: ExamModeStrategy,
  singleMode: ExamQuestionMode | undefined,
  questionIndex: number
): ExamQuestionMode {
  if (modeStrategy === "single") {
    return singleMode ?? "learn";
  }
  return questionIndex % 2 === 0 ? "learn" : "match";
}

export function generateExamQuestions(
  flags: Doc<"flags">[],
  config: ExamGenerationConfig
): GenerateExamQuestionsResult {
  if (flags.length < 4) {
    throw new Error("Official exam requires at least 4 flags for multiple-choice generation.");
  }

  const random = createSeededRandom(config.seed);
  const orderedFlags = shuffleWithRandom(flags, random);
  const answerPositions = buildBalancedAnswerPositions(orderedFlags.length, random);

  const questions: GenerateExamQuestionsResult["questions"] = [];
  const questionChecksums: string[] = [];

  for (let i = 0; i < orderedFlags.length; i++) {
    const targetFlag = orderedFlags[i];
    const mode = resolveQuestionMode(config.modeStrategy, config.singleMode, i);
    const correctPosition = answerPositions[i];
    const distractors = buildDistractors(targetFlag, orderedFlags, mode, random);
    const { options, correctAnswer } = buildQuestionOptions({
      targetFlag,
      distractors,
      mode,
      correctPosition,
      random,
    });

    const questionChecksum = buildQuestionChecksum({
      examAttemptId: "pending",
      questionIndex: i,
      flagKey: targetFlag.key,
      mode,
      options,
      correctAnswer,
    });

    questionChecksums.push(questionChecksum);
    questions.push({
      questionIndex: i,
      flagId: targetFlag._id,
      flagKey: targetFlag.key,
      mode,
      options,
      correctAnswer,
      checksum: questionChecksum,
    });
  }

  const examChecksum = buildExamChecksum({
    seed: config.seed,
    questionChecksums,
  });

  const flagSnapshot: ExamFlagSnapshotItem[] = orderedFlags.map((flag) => ({
    flagId: flag._id,
    key: flag.key,
    name: flag.name,
    meaning: flag.meaning,
    imagePath: flag.imagePath,
    type: flag.type,
    category: flag.category,
    order: flag.order,
    difficulty: flag.difficulty,
  }));

  return {
    questions,
    generationSnapshot: {
      seed: config.seed,
      questionCount: questions.length,
      modeStrategy: config.modeStrategy,
      singleMode: config.modeStrategy === "single" ? config.singleMode : undefined,
      examChecksum,
      generationVersion: config.generationVersion,
    },
    flagSnapshot,
  };
}

export function applyExamAttemptToQuestions(
  questions: GenerateExamQuestionsResult["questions"],
  examAttemptId: Id<"examAttempts">,
  userId: Id<"users">
): Omit<ExamQuestionRecord, "answeredAt" | "isCorrect">[] {
  return questions.map((question) => ({
    examAttemptId,
    userId,
    questionIndex: question.questionIndex,
    flagId: question.flagId,
    flagKey: question.flagKey,
    mode: question.mode,
    options: question.options,
    correctAnswer: question.correctAnswer,
    userAnswer: null,
    checksum: question.checksum,
  }));
}


