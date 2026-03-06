import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    role: v.union(v.literal("cadet"), v.literal("admin"), v.literal("instructor")),
    rank: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
  .index("by_clerkId", ["clerkId"])
  .index("by_email", ["email"]),

  // New Flags Table
  flags: defineTable({
    // Unique identifier (e.g., 'alpha', 'one')
    key: v.string(),
    
    // Categorization
    type: v.union(
      v.literal("flag-letter"),
      v.literal("flag-number"),
      v.literal("pennant-number"),
      v.literal("special-pennant"),
      v.literal("substitute")
    ),
    category: v.string(), // e.g., 'letters', 'numbers' - helpful for broad grouping
    
    // Core Data
    name: v.string(),     // e.g., 'Alpha'
    meaning: v.string(),  // e.g., 'Diver Down'
    description: v.string(), // Expanded description 
    
    // Visuals & Identification
    imagePath: v.string(), // e.g., '/signals/flags/flag-letters/alpha.svg'
    colors: v.array(v.string()), // ['white', 'blue']
    pattern: v.optional(v.string()), // 'vertical-split', etc.
    tips: v.optional(v.string()), // 'Vertical white and blue halves'
    
    // Metadata
    phonetic: v.optional(v.string()), // 'Alfa'
    difficulty: v.optional(v.union(
      v.literal("beginner"), 
      v.literal("intermediate"), 
      v.literal("advanced")
    )),
    
    // Ordering for lists
    order: v.number(), 
  })
  .index("by_key", ["key"])           // Fast lookup by ID
  .index("by_type", ["type"])         // Filter by specific type
  .index("by_category", ["category"]) // Filter by broad category
  .index("by_order", ["order"]),      // Get flags in correct sequence

  // Practice Sessions Table
  practiceSessions: defineTable({
    userId: v.id("users"),
    mode: v.union(v.literal("learn"), v.literal("match")),
    sessionLength: v.number(),
    flagIds: v.array(v.id("flags")),
    currentIndex: v.number(),
    score: v.number(),
    correctCount: v.number(), // Number of correct answers (0 initially)
    status: v.union(
      v.literal("active"),
      v.literal("completed"),
      v.literal("abandoned")
    ),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
    timeTaken: v.optional(v.number()), // Total session duration in ms (completedAt - startedAt)
    
    // Question Generation Data (optional for backward compatibility)
    questions: v.optional(v.array(v.object({
      flagId: v.id("flags"),
      questionType: v.union(v.literal("learn"), v.literal("match")),
      options: v.array(v.object({
        id: v.string(),        // Unique identifier (e.g., "opt_0", "opt_1")
        label: v.string(),     // Display text (flag name for "learn" mode, empty for "match" mode)
        value: v.string(),     // Flag key or identifier
        imagePath: v.optional(v.string()), // Image path for "match" mode (flag image to display)
      })),
      correctAnswer: v.string(), // ID of correct option
      userAnswer: v.union(v.string(), v.null()), // ID of selected option, null initially
    }))),
    
    // Performance & Analytics Metadata
    generationTime: v.optional(v.number()), // Time taken to generate questions (ms)
  })
  .index("by_user", ["userId"])
  .index("by_user_status", ["userId", "status"])
  .index("by_status", ["status"])
  .index("by_user_completedAt", ["userId", "completedAt"]), // For date-range analytics queries

  // Official Exam Attempts Table
  examAttempts: defineTable({
    userId: v.id("users"),

    // Lifecycle state for official exam attempt records.
    status: v.union(
      v.literal("started"),
      v.literal("completed"),
      v.literal("abandoned")
    ),
    attemptNumber: v.number(),

    // Required acknowledgments captured before exam start.
    rulesAcknowledgedAt: v.number(),
    readinessAcknowledgedAt: v.number(),
    rulesViewDurationMs: v.number(),

    // Policy snapshot locked at start for auditability.
    policySnapshot: v.object({
      passThresholdPercent: v.number(),
      totalQuestions: v.number(),
      isUntimed: v.boolean(),
      timeLimitMinutes: v.optional(v.number()),
      singleAttemptOnly: v.boolean(),
      noPauseResume: v.boolean(),
      noBacktracking: v.boolean(),
      requiresAllAnswers: v.boolean(),
    }),

    // Prerequisite context captured at exam start.
    prerequisiteSnapshot: v.object({
      minimumPracticeSessionsRequired: v.number(),
      userPracticeSessions: v.number(),
      userPracticeAveragePercent: v.number(),
    }),

    // Best-effort client environment and network capture.
    systemSnapshot: v.object({
      ipAddress: v.optional(v.string()),
      userAgent: v.optional(v.string()),
      browserFamily: v.optional(v.string()),
      browserVersion: v.optional(v.string()),
      browserSupported: v.boolean(),
      stableInternetConfirmed: v.boolean(),
    }),

    // Optional instructor-proctored scheduling metadata.
    proctorInfo: v.optional(v.object({
      instructorName: v.string(),
      scheduledStartAt: v.number(),
      instructions: v.optional(v.string()),
    })),

    startedAt: v.number(),
    completedAt: v.optional(v.number()),
    immutableAt: v.optional(v.number()),

    // Optional result payload once completed.
    result: v.optional(v.object({
      totalQuestions: v.number(),
      correctCount: v.number(),
      scorePercent: v.number(),
      passed: v.boolean(),
    })),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
  .index("by_user", ["userId"])
  .index("by_user_startedAt", ["userId", "startedAt"])
  .index("by_user_status", ["userId", "status"])
  .index("by_status_startedAt", ["status", "startedAt"]),
});
