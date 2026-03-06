import { OFFICIAL_EXAM_MIN_PRACTICE_SESSIONS } from "./exam_policy";

interface ExamStartBlockersInput {
  userRole: "cadet" | "admin" | "instructor";
  totalQuestions: number;
  userPracticeSessions: number;
  hasOfficialAttempt: boolean;
}

interface ExamAcknowledgementInput {
  rulesAcknowledged: boolean;
  readinessAcknowledged: boolean;
  rulesViewDurationMs: number;
  minimumRulesViewDurationMs: number;
}

export function getExamStartBlockers(input: ExamStartBlockersInput): string[] {
  const blockers: string[] = [];

  if (input.userRole !== "cadet") {
    blockers.push("Only cadets can start an official exam attempt.");
  }

  if (input.totalQuestions === 0) {
    blockers.push("Exam is unavailable because no flags are currently loaded.");
  }

  if (input.userPracticeSessions < OFFICIAL_EXAM_MIN_PRACTICE_SESSIONS) {
    blockers.push(
      `Complete at least ${OFFICIAL_EXAM_MIN_PRACTICE_SESSIONS} practice sessions before starting the official exam.`
    );
  }

  if (input.hasOfficialAttempt) {
    blockers.push("You already have an official exam attempt on record.");
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
