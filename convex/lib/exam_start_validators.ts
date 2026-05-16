import { OFFICIAL_EXAM_MIN_PRACTICE_SESSIONS } from "./exam_policy";

interface ExamStartBlockersInput {
  availableFlagsCount: number;
  configuredQuestionCount: number;
  userPracticeSessions: number;
  examEnabled: boolean;
  maintenanceModeEnabled: boolean;
  maintenanceMessage?: string;
  isWithinAvailabilityWindow: boolean;
  maxRetakes: number;
  completedOfficialAttempts: number;
  retakeCooldownHours: number;
  latestCompletedAttemptAt?: number;
  nowMs: number;
}

interface ExamAcknowledgementInput {
  rulesAcknowledged: boolean;
  readinessAcknowledged: boolean;
  rulesViewDurationMs: number;
  minimumRulesViewDurationMs: number;
}

export function getExamStartBlockers(input: ExamStartBlockersInput): string[] {
  const blockers: string[] = [];

  if (!input.examEnabled) {
    blockers.push("Exam is currently disabled by an administrator.");
  }

  if (input.maintenanceModeEnabled) {
    blockers.push(
      input.maintenanceMessage?.trim() ||
        "Exam access is temporarily unavailable due to scheduled maintenance."
    );
  }

  if (!input.isWithinAvailabilityWindow) {
    blockers.push("Exam is currently outside the configured availability window.");
  }

  if (input.availableFlagsCount === 0) {
    blockers.push("Exam is unavailable because no flags are currently loaded.");
  }

  if (input.availableFlagsCount > 0 && input.availableFlagsCount < 4) {
    blockers.push(
      "Exam is unavailable because at least 4 flags are required for multiple-choice questions."
    );
  }

  if (input.configuredQuestionCount < 4) {
    blockers.push("Exam configuration is invalid because question count must be at least 4.");
  }

  if (input.configuredQuestionCount > input.availableFlagsCount) {
    blockers.push(
      "Exam is unavailable because configured question count exceeds available flags."
    );
  }

  if (input.userPracticeSessions < OFFICIAL_EXAM_MIN_PRACTICE_SESSIONS) {
    blockers.push(
      `Complete at least ${OFFICIAL_EXAM_MIN_PRACTICE_SESSIONS} practice sessions before starting the official exam.`
    );
  }

  const totalAllowedAttempts = input.maxRetakes + 1;
  if (input.completedOfficialAttempts >= totalAllowedAttempts) {
    blockers.push(
      `Exam retake limit reached. Maximum allowed attempts: ${totalAllowedAttempts}.`
    );
  }

  if (
    input.retakeCooldownHours > 0 &&
    typeof input.latestCompletedAttemptAt === "number" &&
    Number.isFinite(input.latestCompletedAttemptAt)
  ) {
    const cooldownMs = input.retakeCooldownHours * 60 * 60 * 1000;
    const nextAllowedAt = input.latestCompletedAttemptAt + cooldownMs;
    if (input.nowMs < nextAllowedAt) {
      const remainingMinutes = Math.ceil((nextAllowedAt - input.nowMs) / (60 * 1000));
      blockers.push(
        `Retake cooldown active. Try again in approximately ${remainingMinutes} minute${remainingMinutes === 1 ? "" : "s"}.`
      );
    }
  }

  return blockers;
}

export function getExamAcknowledgementErrors(input: ExamAcknowledgementInput): string[] {
  const errors: string[] = [];

  if (!input.rulesAcknowledged) {
    errors.push("You must acknowledge that you have read and understand the examination rules.");
  }

  if (!input.readinessAcknowledged) {
    errors.push("You must confirm that you are ready to begin your official assessment.");
  }

  if (!Number.isFinite(input.rulesViewDurationMs) || input.rulesViewDurationMs < 0) {
    errors.push("Rules view duration must be a valid non-negative number.");
  }

  if (input.rulesViewDurationMs < input.minimumRulesViewDurationMs) {
    const minimumSeconds = Math.ceil(input.minimumRulesViewDurationMs / 1000);
    errors.push(`Please review the examination rules for at least ${minimumSeconds} seconds.`);
  }

  return errors;
}
