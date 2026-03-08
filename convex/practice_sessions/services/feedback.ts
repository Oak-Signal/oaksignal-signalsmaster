import { Doc } from "../../_generated/dataModel";
import { Question } from "../../lib/types";

export function buildSimilarFlags(
  currentFlag: Doc<"flags">,
  allFlags: Doc<"flags">[]
) {
  const otherFlags = allFlags.filter((flag) => flag._id !== currentFlag._id);

  const flagsWithScores = otherFlags.map((otherFlag) => {
    let similarityScore = 0;

    if (otherFlag.type === currentFlag.type) {
      similarityScore += 3;
    }

    if (otherFlag.category === currentFlag.category) {
      similarityScore += 2;
    }

    const sharedColors = otherFlag.colors.filter((color) =>
      currentFlag.colors.includes(color)
    ).length;
    similarityScore += sharedColors * 2;

    if (
      otherFlag.pattern &&
      currentFlag.pattern &&
      otherFlag.pattern === currentFlag.pattern
    ) {
      similarityScore += 4;
    }

    if (otherFlag.difficulty === currentFlag.difficulty) {
      similarityScore += 1;
    }

    return {
      flag: otherFlag,
      similarityScore,
    };
  });

  return flagsWithScores
    .filter((item) => item.similarityScore > 0)
    .sort((a, b) => b.similarityScore - a.similarityScore)
    .slice(0, 4)
    .map((item) => ({
      _id: item.flag._id,
      key: item.flag.key,
      name: item.flag.name,
      imagePath: item.flag.imagePath,
      matchReason:
        item.similarityScore >= 5
          ? "Similar colors and pattern"
          : item.similarityScore >= 3
            ? "Same type"
            : "Similar appearance",
    }));
}

export function buildAnswerLabels(
  question: Question,
  mode: "learn" | "match",
  selectedAnswer: string,
  fallbackCorrectLabel: string
) {
  const userAnswerOption = question.options.find((opt) => opt.id === selectedAnswer);
  const correctAnswerOption = question.options.find(
    (opt) => opt.id === question.correctAnswer
  );

  const userAnswerLabel = userAnswerOption
    ? mode === "match"
      ? userAnswerOption.value
      : userAnswerOption.label
    : "Unknown";

  const correctAnswerLabel = correctAnswerOption
    ? mode === "match"
      ? correctAnswerOption.value
      : correctAnswerOption.label
    : fallbackCorrectLabel;

  return { userAnswerLabel, correctAnswerLabel };
}
