import { Id } from "@/convex/_generated/dataModel";
import { PracticeMode, SessionLength, SessionStatus } from "./practice-constants";
import type { FlagDetails, SimilarFlagData, AnswerFeedbackContext } from "./feedback-types";

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

/**
 * Practice Session Configuration
 * Parameters chosen by user before starting practice
 */
export interface SessionConfig {
  mode: PracticeMode;
  sessionLength: SessionLength;
}

/**
 * Practice Session (mirrors Convex schema)
 */
export interface PracticeSession {
  _id: Id<"practiceSessions">;
  _creationTime: number;
  userId: Id<"users">;
  mode: PracticeMode;
  sessionLength: number;
  flagIds: Id<"flags">[];
  currentIndex: number;
  score: number;
  correctCount: number;              // Number of correct answers (0 initially)
  status: SessionStatus;
  startedAt: number;
  completedAt?: number;
  
  // Question Generation Data (optional for backward compatibility with legacy sessions)
  questions?: Question[];
  
  // Performance Metadata
  generationTime?: number;           // Time taken to generate questions (ms)
}

/**
 * User Practice Statistics
 * Aggregated data from completed sessions
 */
export interface PracticeStats {
  totalSessions: number;
  completedSessions: number;
  averageScore: number;
  lastPracticed?: number;
  totalFlagsPracticed: number;
  favoriteMode?: PracticeMode;
}

/**
 * Session Creation Input
 */
export interface CreateSessionInput {
  mode: PracticeMode;
  sessionLength: number;
  flagIds: Id<"flags">[];
}

/**
 * Session Selection State (UI)
 */
export interface SessionSelectionState {
  selectedMode: PracticeMode | null;
  selectedLength: SessionLength | null;
  isValid: boolean;
}

/**
 * Validation Result
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Session Generation Performance Metrics
 * Tracks question generation performance for monitoring
 */
export interface SessionGenerationMetrics {
  startTime: number;
  endTime: number;
  durationMs: number;
  flagCount: number;
  questionCount: number;
  exceedsThreshold: boolean;         // True if generation took > 2000ms
}

/**
 * Quiz Interface State
 * Manages the state of the interactive quiz UI
 */
export interface QuizState {
  currentQuestionIndex: number;
  selectedAnswer: string | null;     // ID of selected option (e.g., "opt_2")
  isSubmitting: boolean;              // True while submitAnswer mutation is in flight
  isAnswered: boolean;                // True after answer is submitted
  isCorrect: boolean | null;          // True/false after validation, null before
  streak: number;                     // Current consecutive correct answer streak
  showFeedback: boolean;              // True to display feedback overlay
}

/**
 * Answer Submission Payload
 * Data sent to submitAnswer mutation
 */
export interface AnswerSubmission {
  sessionId: Id<"practiceSessions">;
  questionIndex: number;
  selectedAnswer: string;             // Option ID (e.g., "opt_1")
  timeSpent?: number;                 // Optional: milliseconds spent on question
}

/**
 * Answer Submission Result
 * Response from submitAnswer mutation
 */
export interface AnswerResult {
  isCorrect: boolean;
  correctAnswer: string;              // ID of correct option for feedback
  currentStreak: number;              // Updated streak count
  score: number;                      // Updated session score
  correctCount: number;               // Updated correct answer count
  isSessionComplete: boolean;         // True if this was the last question
  nextQuestionIndex?: number;         // Index of next question (if not complete)
}

/**
 * Question Timing Metadata
 * Tracks time spent on individual questions
 */
export interface QuestionTiming {
  questionIndex: number;
  startTime: number;                  // Timestamp when question displayed
  endTime?: number;                   // Timestamp when answer submitted
  duration?: number;                  // Milliseconds (endTime - startTime)
}

/**
 * Session Progress Summary
 * Real-time progress statistics during quiz
 */
export interface SessionProgress {
  currentIndex: number;
  totalQuestions: number;
  correctCount: number;
  incorrectCount: number;
  streak: number;
  accuracy: number;                   // Percentage (0-100)
  questionsRemaining: number;
}

/**
 * Current Question with Full Flag Data
 * Enhanced question data returned by getCurrentQuestion query
 */
export interface CurrentQuestionData {
  question: Question;
  flag: {
    _id: Id<"flags">;
    key: string;
    type: string;
    name: string;
    meaning: string;
    imagePath: string;
    colors: string[];
    description: string;
  };
  questionIndex: number;
  totalQuestions: number;
  progress: SessionProgress;
}
/**
 * Extended Answer Submission Result with Flag Details
 * Enhanced response from submitAnswer mutation including flag data for modal
 */
export interface ExtendedAnswerResult extends AnswerResult {
  flagDetails?: FlagDetails;          // Complete flag data for feedback modal
  similarFlags?: SimilarFlagData[];   // Related/confusable flags
}

/**
 * Feedback Modal State Management
 * Tracks modal visibility, timing, and interaction state
 */
export interface FeedbackModalState {
  isOpen: boolean;                    // Modal visibility
  feedbackContext: AnswerFeedbackContext | null; // Answer result data
  flagDetails: FlagDetails | null;    // Current flag being displayed
  similarFlags: SimilarFlagData[];    // Confusable flags
  displayStartTime: number | null;    // Timestamp when modal opened
  canDismiss: boolean;                // True after minimum display time elapsed
  isNavigating: boolean;              // True during transition to next question
}

/**
 * Feedback Modal Actions
 * User interactions with feedback modal
 */
export interface FeedbackModalActions {
  onNext: () => void;                 // Advance to next question
  onViewResults: () => void;          // View final results (last question)
  onDismiss: () => void;              // Close modal
  onLearnMore: (flagKey: string) => void; // Navigate to flag reference
  onReportIssue?: (flagId: Id<"flags">) => void; // Report problem (future)
}

// Re-export feedback types for convenience
export type { FlagDetails, SimilarFlagData, AnswerFeedbackContext } from "./feedback-types";