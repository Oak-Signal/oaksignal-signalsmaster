/**
 * Deterministic randomization helpers for official exam generation.
 */

export type SeededRandom = () => number;

export function createSeededRandom(seed: number): SeededRandom {
  let state = seed >>> 0;

  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export function generateExamSeed(input: {
  now: number;
  attemptNumber: number;
  userId: string;
}): number {
  // Mix user id characters with attempt metadata into a 32-bit seed.
  let hash = 2166136261;
  const source = `${input.userId}:${input.attemptNumber}:${input.now}`;
  for (let i = 0; i < source.length; i++) {
    hash ^= source.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

export function shuffleWithRandom<T>(array: T[], random: SeededRandom): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function buildBalancedAnswerPositions(
  questionCount: number,
  random: SeededRandom
): number[] {
  const positions: number[] = [];
  for (let i = 0; i < questionCount; i++) {
    positions.push(i % 4);
  }
  return shuffleWithRandom(positions, random);
}

