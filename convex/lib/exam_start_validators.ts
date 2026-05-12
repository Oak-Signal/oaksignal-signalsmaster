import { OFFICIAL_EXAM_MIN_PRACTICE_SESSIONS } from "./exam_policy";

interface ExamStartBlockersInput {
  totalQuestions: number;
  userPracticeSessions: number;
}

interface ExamAcknowledgementInput {
  rulesAcknowledged: boolean;
  readinessAcknowledged: boolean;
  rulesViewDurationMs: number;
  minimumRulesViewDurationMs: number;
}

export function getExamStartBlockers(input: ExamStartBlockersInput): string[] {
  const blockers: string[] = [];

  if (input.totalQuestions === 0) {
    blockers.push("Exam is unavailable because no flags are currently loaded.");
  }

  if (input.totalQuestions > 0 && input.totalQuestions < 4) {
    blockers.push(
      "Exam is unavailable because at least 4 flags are required for multiple-choice questions."
    );
  }

  if (input.userPracticeSessions < OFFICIAL_EXAM_MIN_PRACTICE_SESSIONS) {
    blockers.push(
      `Complete at least ${OFFICIAL_EXAM_MIN_PRACTICE_SESSIONS} practice sessions before starting the official exam.`
    );
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
