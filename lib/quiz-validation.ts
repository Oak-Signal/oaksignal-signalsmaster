/**
 * Quiz Validation Utilities
 * Client-side validation helpers for quiz interactions
 */

import { PracticeSession, Question, AnswerSubmission } from "./practice-types";
import { SESSION_STATUS } from "./practice-constants";

/**
 * Validate that a session is in a valid state for answering questions
 */
export function validateSessionForQuiz(session: PracticeSession | null | undefined): {
  isValid: boolean;
  error?: string;
} {
  if (!session) {
    return { isValid: false, error: "Session not found" };
  }

  if (session.status !== SESSION_STATUS.ACTIVE) {
    return { isValid: false, error: `Session is ${session.status}. Only active sessions can be answered.` };
  }

  if (!session.questions || session.questions.length === 0) {
    return { isValid: false, error: "Session has no questions. This may be a legacy session." };
  }

  if (session.currentIndex >= session.questions.length) {
    return { isValid: false, error: "Session is already complete" };
  }

  return { isValid: true };
}

/**
 * Validate that a question index is within bounds
 */
export function validateQuestionIndex(
  questionIndex: number,
  totalQuestions: number
): {
  isValid: boolean;
  error?: string;
} {
  if (questionIndex < 0) {
    return { isValid: false, error: "Question index cannot be negative" };
  }

  if (questionIndex >= totalQuestions) {
    return { isValid: false, error: `Question index ${questionIndex} exceeds total questions ${totalQuestions}` };
  }

  return { isValid: true };
}

/**
 * Validate that a selected answer is a valid option for the question
 */
export function validateAnswerOption(
  selectedAnswer: string,
  question: Question
): {
  isValid: boolean;
  error?: string;
} {
  if (!selectedAnswer || selectedAnswer.trim() === "") {
    return { isValid: false, error: "No answer selected" };
  }

  const optionIds = question.options.map(opt => opt.id);
  
  if (!optionIds.includes(selectedAnswer)) {
    return { isValid: false, error: `Selected answer "${selectedAnswer}" is not a valid option. Valid options: ${optionIds.join(", ")}` };
  }

  return { isValid: true };
}

/**
 * Validate that a question has not already been answered
 */
export function validateQuestionNotAnswered(question: Question): {
  isValid: boolean;
  error?: string;
} {
  if (question.userAnswer !== null) {
    return { isValid: false, error: "This question has already been answered" };
  }

  return { isValid: true };
}

/**
 * Comprehensive validation for answer submission
 */
export function validateAnswerSubmission(
  submission: AnswerSubmission,
  session: PracticeSession
): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Validate session state
  const sessionValidation = validateSessionForQuiz(session);
  if (!sessionValidation.isValid) {
    errors.push(sessionValidation.error!);
  }

  // Validate question index matches current session index
  if (submission.questionIndex !== session.currentIndex) {
    errors.push(
      `Submission index ${submission.questionIndex} does not match session current index ${session.currentIndex}`
    );
  }

  // Validate question index bounds
  if (session.questions) {
    const indexValidation = validateQuestionIndex(
      submission.questionIndex,
      session.questions.length
    );
    if (!indexValidation.isValid) {
      errors.push(indexValidation.error!);
    }

    // Validate selected answer if question exists
    if (indexValidation.isValid) {
      const question = session.questions[submission.questionIndex];
      const answerValidation = validateAnswerOption(submission.selectedAnswer, question);
      if (!answerValidation.isValid) {
        errors.push(answerValidation.error!);
      }

      // Check if question already answered
      const alreadyAnsweredValidation = validateQuestionNotAnswered(question);
      if (!alreadyAnsweredValidation.isValid) {
        errors.push(alreadyAnsweredValidation.error!);
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Check if a session is complete (all questions answered)
 */
export function isSessionComplete(session: PracticeSession): boolean {
  if (!session.questions || session.questions.length === 0) {
    return false;
  }

  return session.currentIndex >= session.questions.length;
}

/**
 * Calculate current streak from questions array
 * Counts consecutive correct answers from most recent backwards
 */
export function calculateStreak(questions: Question[]): number {
  let streak = 0;

  // Iterate backwards from most recent answered question
  for (let i = questions.length - 1; i >= 0; i--) {
    const question = questions[i];
    
    // Skip unanswered questions
    if (question.userAnswer === null) {
      continue;
    }

    // Check if answer is correct
    if (question.userAnswer === question.correctAnswer) {
      streak++;
    } else {
      // Streak breaks on first incorrect answer
      break;
    }
  }

  return streak;
}

/**
 * Calculate accuracy percentage from questions array
 */
export function calculateAccuracy(questions: Question[]): number {
  const answeredQuestions = questions.filter(q => q.userAnswer !== null);
  
  if (answeredQuestions.length === 0) {
    return 0;
  }

  const correctCount = answeredQuestions.filter(
    q => q.userAnswer === q.correctAnswer
  ).length;

  return Math.round((correctCount / answeredQuestions.length) * 100);
}

/**
 * Validate keyboard shortcut key
 */
export function isValidQuizShortcutKey(key: string): boolean {
  const validKeys = ['1', '2', '3', '4', 'Enter', '?', 'Escape'];
  return validKeys.includes(key);
}

/**
 * Map keyboard key to option index (0-3)
 */
export function mapKeyToOptionIndex(key: string): number | null {
  const keyMap: Record<string, number> = {
    '1': 0,
    '2': 1,
    '3': 2,
    '4': 3,
  };

  return keyMap[key] ?? null;
}
