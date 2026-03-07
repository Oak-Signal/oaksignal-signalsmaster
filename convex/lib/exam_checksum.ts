/**
 * Lightweight checksum helpers for exam integrity checks.
 */

import { ExamQuestionOption } from "./exam_types";

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>).sort(
    ([a], [b]) => a.localeCompare(b)
  );
  return `{${entries
    .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`)
    .join(",")}}`;
}

function fnv1aHex(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function buildQuestionChecksum(input: {
  examAttemptId: string;
  questionIndex: number;
  flagKey: string;
  mode: "learn" | "match";
  options: ExamQuestionOption[];
  correctAnswer: string;
}): string {
  const serialized = stableStringify(input);
  return fnv1aHex(serialized);
}

export function buildExamChecksum(input: {
  seed: number;
  questionChecksums: string[];
}): string {
  const serialized = stableStringify(input);
  return fnv1aHex(serialized);
}


