/**
 * Shared types for Convex practice session functions.
 * These mirror types in lib/practice-types.ts but are specific to Convex backend.
 */

import { Id } from "../_generated/dataModel";

/**
 * Question Type - matches practice mode
 */
export type QuestionType = "learn" | "match";

/**
 * Individual multiple-choice option within a question
 */
export interface QuestionOption {
  id: string;        // Unique identifier (e.g., "opt_0", "opt_1", "opt_2", "opt_3")
  label: string;     // Display text (flag name for "learn" mode, empty for "match" mode which uses images)
  value: string;     // Flag key or identifier
  imagePath?: string; // Image path for "match" mode (flag image to display as option)
}

/**
 * Individual question in a practice session
 * Contains flag reference, shuffled options, and answer tracking
 */
export interface Question {
  flagId: Id<"flags">;              // Reference to the flag being tested
  questionType: QuestionType;       // "learn" or "match"
  options: QuestionOption[];        // Array of 4 shuffled multiple-choice options
  correctAnswer: string;            // ID of the correct option (matches one of options[].id)
  userAnswer: string | null;        // ID of user's selected option, null if unanswered
  answeredAt?: number;              // Server timestamp (ms) when userAnswer was accepted
}
