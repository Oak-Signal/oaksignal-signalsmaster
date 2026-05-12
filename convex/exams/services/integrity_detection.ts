import { Doc } from "../../_generated/dataModel";

export interface ExamIntegrityThresholds {
  minAverageAnswerTimeMs: number;
  maxConsecutiveSameAnswer: number;
  minExpectedDurationRatioPercent: number;
  minAnswerTimeStdDevMs: number;
}

export type IntegritySeverity = "low" | "medium" | "high";

export interface ExamIntegrityFlag {
  ruleId: string;
  severity: IntegritySeverity;
  title: string;
  description: string;
}

export interface ExamIntegritySignals {
  expectedDurationMs: number;
  actualDurationMs: number;
  averageAnswerTimeMs: number;
  answerTimeStdDevMs: number;
  maxConsecutiveSameAnswer: number;
  matchedRuleIds: string[];
  flags: ExamIntegrityFlag[];
}

export interface ExamIntegrityAssessment {
  hasIntegrityFlags: boolean;
  integrityScore: number;
  integritySeverity?: IntegritySeverity;
  integritySignals: ExamIntegritySignals;
}

function roundToTwoDecimals(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function calculateStdDev(values: number[], mean: number): number {
  if (values.length === 0) {
    return 0;
  }

  const variance =
    values.reduce((sum, value) => {
      const delta = value - mean;
      return sum + delta * delta;
    }, 0) / values.length;

  return Math.sqrt(variance);
}

function getMaxConsecutiveSameAnswer(
  questionBreakdown: Array<{ selectedAnswer: string | null }>
): number {
  let maxRun = 0;
  let currentRun = 0;
  let previousAnswer: string | null = null;

  for (const item of questionBreakdown) {
    const currentAnswer = item.selectedAnswer;
    if (!currentAnswer) {
      currentRun = 0;
      previousAnswer = null;
      continue;
    }

    if (currentAnswer === previousAnswer) {
      currentRun += 1;
    } else {
      currentRun = 1;
      previousAnswer = currentAnswer;
    }

    if (currentRun > maxRun) {
      maxRun = currentRun;
    }
  }

  return maxRun;
}

function getOverallSeverity(flags: ExamIntegrityFlag[]): IntegritySeverity | undefined {
  if (flags.length === 0) {
    return undefined;
  }

  if (flags.some((flag) => flag.severity === "high")) {
    return "high";
  }

  if (flags.some((flag) => flag.severity === "medium")) {
    return "medium";
  }

  return "low";
}

function buildIntegrityScore(flags: ExamIntegrityFlag[]): number {
  const penalty = flags.reduce((sum, flag) => {
    if (flag.severity === "high") {
      return sum + 35;
    }

    if (flag.severity === "medium") {
      return sum + 20;
    }

    return sum + 10;
  }, 0);

  return Math.max(0, Math.min(100, 100 - penalty));
}

export function evaluateOfficialExamIntegrity(input: {
  startedAt: number;
  completedAt: number;
  expectedDurationMs: number;
  questionBreakdown: Array<{
    selectedAnswer: string | null;
    responseTimeMs?: number;
  }>;
  thresholds: ExamIntegrityThresholds;
  attempt: Pick<Doc<"examAttempts">, "systemSnapshot">;
  auditEvents: string[];
}): ExamIntegrityAssessment {
  const actualDurationMs = Math.max(0, input.completedAt - input.startedAt);
  const responseTimes = input.questionBreakdown
    .map((item) => item.responseTimeMs)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0);

  const averageAnswerTimeMs =
    responseTimes.length > 0
      ? responseTimes.reduce((sum, value) => sum + value, 0) / responseTimes.length
      : 0;

  const answerTimeStdDevMs = calculateStdDev(responseTimes, averageAnswerTimeMs);
  const maxConsecutiveSameAnswer = getMaxConsecutiveSameAnswer(input.questionBreakdown);

  const durationRatioPercent =
    input.expectedDurationMs > 0
      ? (actualDurationMs / input.expectedDurationMs) * 100
      : 100;

  const flags: ExamIntegrityFlag[] = [];

  if (averageAnswerTimeMs < input.thresholds.minAverageAnswerTimeMs) {
    flags.push({
      ruleId: "timing.average_too_fast",
      severity: "medium",
      title: "Suspicious average answer speed",
      description: `Average answer time ${roundToTwoDecimals(averageAnswerTimeMs / 1000)}s is below threshold ${roundToTwoDecimals(input.thresholds.minAverageAnswerTimeMs / 1000)}s.`,
    });
  }

  if (maxConsecutiveSameAnswer > input.thresholds.maxConsecutiveSameAnswer) {
    flags.push({
      ruleId: "pattern.same_answer_streak",
      severity: "high",
      title: "Repeated answer pattern detected",
      description: `Max consecutive repeated answers ${maxConsecutiveSameAnswer} exceeded threshold ${input.thresholds.maxConsecutiveSameAnswer}.`,
    });
  }

  if (durationRatioPercent < input.thresholds.minExpectedDurationRatioPercent) {
    flags.push({
      ruleId: "speed.exam_completed_too_fast",
      severity: "high",
      title: "Exam completed unusually fast",
      description: `Completion ratio ${roundToTwoDecimals(durationRatioPercent)}% is below expected minimum ${input.thresholds.minExpectedDurationRatioPercent}%.`,
    });
  }

  if (answerTimeStdDevMs < input.thresholds.minAnswerTimeStdDevMs) {
    flags.push({
      ruleId: "consistency.low_variance",
      severity: "medium",
      title: "Answer timing variance unusually low",
      description: `Answer-time standard deviation ${roundToTwoDecimals(answerTimeStdDevMs / 1000)}s is below threshold ${roundToTwoDecimals(input.thresholds.minAnswerTimeStdDevMs / 1000)}s.`,
    });
  }

  const suspiciousAuditEvents = input.auditEvents.filter((eventType) =>
    eventType === "fullscreen_exited" ||
    eventType === "tab_hidden" ||
    eventType === "window_blur" ||
    eventType === "restricted_shortcut_blocked" ||
    eventType === "back_navigation_blocked"
  );

  if (suspiciousAuditEvents.length >= 2) {
    flags.push({
      ruleId: "metadata.security_events",
      severity: "low",
      title: "Abnormal security event activity",
      description: `${suspiciousAuditEvents.length} suspicious client security events were recorded during the attempt.`,
    });
  }

  if (!input.attempt.systemSnapshot.browserSupported) {
    flags.push({
      ruleId: "metadata.unsupported_browser",
      severity: "low",
      title: "Unsupported browser during exam",
      description: "Attempt was completed on a browser outside the recommended support matrix.",
    });
  }

  const integrityScore = buildIntegrityScore(flags);
  const integritySeverity = getOverallSeverity(flags);

  return {
    hasIntegrityFlags: flags.length > 0,
    integrityScore,
    integritySeverity,
    integritySignals: {
      expectedDurationMs: input.expectedDurationMs,
      actualDurationMs,
      averageAnswerTimeMs: roundToTwoDecimals(averageAnswerTimeMs),
      answerTimeStdDevMs: roundToTwoDecimals(answerTimeStdDevMs),
      maxConsecutiveSameAnswer,
      matchedRuleIds: flags.map((flag) => flag.ruleId),
      flags,
    },
  };
}
