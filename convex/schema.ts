import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    role: v.union(v.literal("cadet"), v.literal("admin")),
    status: v.optional(
      v.union(
        v.literal("active"),
        v.literal("suspended"),
        v.literal("banned"),
        v.literal("pending_verification")
      )
    ),
    rank: v.optional(v.string()),
    profileImageUrl: v.optional(v.string()),
    phone: v.optional(v.string()),
    contactEmail: v.optional(v.string()),
    emailVerifiedAt: v.optional(v.number()),
    lastLoginAt: v.optional(v.number()),
    lastActiveAt: v.optional(v.number()),
    statusUpdatedAt: v.optional(v.number()),
    suspendedReason: v.optional(v.string()),
    suspendedUntil: v.optional(v.number()),
    suspensionNotes: v.optional(v.string()),
    suspensionUpdatedBy: v.optional(v.id("users")),
    isFlaggedForReview: v.optional(v.boolean()),
    flaggedForReviewReason: v.optional(v.string()),
    flaggedForReviewAt: v.optional(v.number()),
    flaggedForReviewBy: v.optional(v.id("users")),
    userManagementMigrationVersion: v.optional(v.number()),
    deletedAt: v.optional(v.number()),
    deletedBy: v.optional(v.id("users")),
    deletionReason: v.optional(v.string()),
    mergedIntoUserId: v.optional(v.id("users")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
  .index("by_clerkId", ["clerkId"])
  .index("by_email", ["email"])
  .index("by_createdAt", ["createdAt"])
  .index("by_lastActiveAt", ["lastActiveAt"])
  .index("by_role_createdAt", ["role", "createdAt"])
  .index("by_status_createdAt", ["status", "createdAt"])
  .index("by_status_lastActiveAt", ["status", "lastActiveAt"])
  .index("by_deletedAt", ["deletedAt"]),

  // Audit trail for role assignment and role transition events.
  userRoleChangeLogs: defineTable({
    targetUserId: v.id("users"),
    actorUserId: v.id("users"),
    previousRole: v.union(v.literal("cadet"), v.literal("admin")),
    newRole: v.union(v.literal("cadet"), v.literal("admin")),
    reason: v.string(),
    metadataJson: v.optional(v.string()),
    createdAt: v.number(),
  })
  .index("by_target_createdAt", ["targetUserId", "createdAt"])
  .index("by_actor_createdAt", ["actorUserId", "createdAt"]),

  // Account lifecycle status history (suspend/reactivate/ban/etc).
  userStatusHistory: defineTable({
    targetUserId: v.id("users"),
    actorUserId: v.id("users"),
    previousStatus: v.union(
      v.literal("active"),
      v.literal("suspended"),
      v.literal("banned"),
      v.literal("pending_verification")
    ),
    newStatus: v.union(
      v.literal("active"),
      v.literal("suspended"),
      v.literal("banned"),
      v.literal("pending_verification")
    ),
    reason: v.string(),
    durationUntil: v.optional(v.number()),
    internalNotes: v.optional(v.string()),
    metadataJson: v.optional(v.string()),
    createdAt: v.number(),
  })
  .index("by_target_createdAt", ["targetUserId", "createdAt"])
  .index("by_actor_createdAt", ["actorUserId", "createdAt"])
  .index("by_newStatus_createdAt", ["newStatus", "createdAt"]),

  // Private administrator notes attached to user profiles.
  userAdminNotes: defineTable({
    targetUserId: v.id("users"),
    authorUserId: v.id("users"),
    note: v.string(),
    isPinned: v.optional(v.boolean()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
  .index("by_target_createdAt", ["targetUserId", "createdAt"])
  .index("by_author_createdAt", ["authorUserId", "createdAt"]),

  // Timeline events for user-facing and admin-triggered activity actions.
  userActivityEvents: defineTable({
    targetUserId: v.id("users"),
    actorUserId: v.optional(v.id("users")),
    eventType: v.union(
      v.literal("login"),
      v.literal("logout"),
      v.literal("practice_completed"),
      v.literal("exam_completed"),
      v.literal("ranked_run_completed"),
      v.literal("role_changed"),
      v.literal("status_changed"),
      v.literal("admin_note_added"),
      v.literal("profile_updated"),
      v.literal("notification_sent"),
      v.literal("account_flagged"),
      v.literal("account_unflagged"),
      v.literal("data_export_requested")
    ),
    metadataJson: v.optional(v.string()),
    createdAt: v.number(),
  })
  .index("by_target_createdAt", ["targetUserId", "createdAt"])
  .index("by_eventType_createdAt", ["eventType", "createdAt"]),

  // Login/session history for support and account-security investigations.
  userLoginEvents: defineTable({
    targetUserId: v.id("users"),
    eventType: v.union(
      v.literal("login_success"),
      v.literal("login_failed"),
      v.literal("session_started"),
      v.literal("session_ended")
    ),
    ipAddress: v.optional(v.string()),
    device: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    sessionId: v.optional(v.string()),
    metadataJson: v.optional(v.string()),
    createdAt: v.number(),
  })
  .index("by_target_createdAt", ["targetUserId", "createdAt"])
  .index("by_eventType_createdAt", ["eventType", "createdAt"]),

  // Saved admin filter combinations for user list workflows.
  userFilterPresets: defineTable({
    ownerUserId: v.id("users"),
    name: v.string(),
    filtersJson: v.string(),
    isShared: v.optional(v.boolean()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
  .index("by_owner_updatedAt", ["ownerUserId", "updatedAt"])
  .index("by_shared_updatedAt", ["isShared", "updatedAt"]),

  // Admin-defined groups/cohorts for bulk actions.
  userCohorts: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    createdBy: v.id("users"),
    updatedBy: v.id("users"),
    archivedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
  .index("by_archived_updatedAt", ["archivedAt", "updatedAt"])
  .index("by_updatedAt", ["updatedAt"]),

  // Membership links between users and admin-defined cohorts.
  userCohortMembers: defineTable({
    cohortId: v.id("userCohorts"),
    userId: v.id("users"),
    addedBy: v.id("users"),
    addedAt: v.number(),
  })
  .index("by_cohort_addedAt", ["cohortId", "addedAt"])
  .index("by_user_addedAt", ["userId", "addedAt"])
  .index("by_cohort_user", ["cohortId", "userId"]),

  // GDPR data export request lifecycle records.
  gdprExportRequests: defineTable({
    requestedByUserId: v.id("users"),
    targetUserId: v.id("users"),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("expired"),
      v.literal("cancelled")
    ),
    reason: v.optional(v.string()),
    exportUrl: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
    metadataJson: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    completedAt: v.optional(v.number()),
  })
  .index("by_status_createdAt", ["status", "createdAt"])
  .index("by_target_createdAt", ["targetUserId", "createdAt"])
  .index("by_requester_createdAt", ["requestedByUserId", "createdAt"]),

  // GDPR deletion request and approval workflow records.
  gdprDeletionRequests: defineTable({
    requestedByUserId: v.id("users"),
    targetUserId: v.id("users"),
    status: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("rejected"),
      v.literal("scheduled"),
      v.literal("completed"),
      v.literal("cancelled")
    ),
    reason: v.optional(v.string()),
    internalNotes: v.optional(v.string()),
    scheduledFor: v.optional(v.number()),
    processedAt: v.optional(v.number()),
    metadataJson: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
  .index("by_status_createdAt", ["status", "createdAt"])
  .index("by_target_createdAt", ["targetUserId", "createdAt"])
  .index("by_requester_createdAt", ["requestedByUserId", "createdAt"]),

  // Duplicate-account merge job lifecycle records.
  userMergeJobs: defineTable({
    requestedByUserId: v.id("users"),
    primaryUserId: v.id("users"),
    duplicateUserId: v.id("users"),
    status: v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("cancelled")
    ),
    dryRun: v.optional(v.boolean()),
    reason: v.optional(v.string()),
    summaryJson: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    completedAt: v.optional(v.number()),
  })
  .index("by_status_createdAt", ["status", "createdAt"])
  .index("by_primary_createdAt", ["primaryUserId", "createdAt"])
  .index("by_duplicate_createdAt", ["duplicateUserId", "createdAt"]),

  // Historical record of completed user merge operations.
  userMergeHistory: defineTable({
    mergedUserId: v.id("users"),
    survivingUserId: v.id("users"),
    mergeJobId: v.optional(v.id("userMergeJobs")),
    mergedBy: v.id("users"),
    metadataJson: v.optional(v.string()),
    createdAt: v.number(),
  })
  .index("by_surviving_createdAt", ["survivingUserId", "createdAt"])
  .index("by_merged_createdAt", ["mergedUserId", "createdAt"]),

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
    examResultId: v.optional(v.id("examResults")),

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
    sessionTokenHash: v.optional(v.string()),
    sessionIssuedAt: v.optional(v.number()),
    sessionExpiresAt: v.optional(v.number()),

    // Optional result payload once completed.
    result: v.optional(v.object({
      totalQuestions: v.number(),
      correctCount: v.number(),
      scorePercent: v.number(),
      passed: v.boolean(),
      modeStats: v.optional(v.object({
        learn: v.object({
          total: v.number(),
          correct: v.number(),
          incorrect: v.number(),
        }),
        match: v.object({
          total: v.number(),
          correct: v.number(),
          incorrect: v.number(),
        }),
      })),
      categoryStats: v.optional(v.array(v.object({
        category: v.string(),
        total: v.number(),
        correct: v.number(),
        incorrect: v.number(),
      }))),
    })),

    // Question generation metadata for reproducibility and auditability.
    generationSnapshot: v.optional(v.object({
      seed: v.number(),
      questionCount: v.number(),
      modeStrategy: v.union(v.literal("alternating"), v.literal("single")),
      singleMode: v.optional(v.union(v.literal("learn"), v.literal("match"))),
      generationStartedAt: v.number(),
      generationCompletedAt: v.number(),
      generationTimeMs: v.number(),
      generationRetryCount: v.number(),
      examChecksum: v.string(),
      generationVersion: v.number(),
    })),

    // Optional historical copy of flag metadata at generation time.
    flagSnapshot: v.optional(v.array(v.object({
      flagId: v.id("flags"),
      key: v.string(),
      name: v.string(),
      meaning: v.string(),
      imagePath: v.string(),
      type: v.union(
        v.literal("flag-letter"),
        v.literal("flag-number"),
        v.literal("pennant-number"),
        v.literal("special-pennant"),
        v.literal("substitute")
      ),
      category: v.string(),
      order: v.number(),
      difficulty: v.optional(v.union(
        v.literal("beginner"),
        v.literal("intermediate"),
        v.literal("advanced")
      )),
    }))),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
  .index("by_user", ["userId"])
  .index("by_user_startedAt", ["userId", "startedAt"])
  .index("by_user_status", ["userId", "status"])
  .index("by_status_startedAt", ["status", "startedAt"]),

  // Immutable official exam results for completed attempts.
  examResults: defineTable({
    examAttemptId: v.id("examAttempts"),
    userId: v.id("users"),
    immutable: v.boolean(),
    immutableAt: v.number(),

    // Stable certificate identity for external verification workflows.
    certificateNumber: v.string(),
    resultVersion: v.number(),

    // User snapshot captured at completion time to preserve historical context.
    userSnapshot: v.object({
      userId: v.id("users"),
      fullName: v.string(),
      roleAtExam: v.union(
        v.literal("cadet"),
        v.literal("admin")
      ),
    }),

    attemptNumber: v.number(),
    startedAt: v.number(),
    completedAt: v.number(),

    totalQuestions: v.number(),
    totalCorrect: v.number(),
    scorePercent: v.number(),
    passThresholdPercent: v.number(),
    passed: v.boolean(),

    // Explicitly preserve the modes that were used in this exam run.
    examModesUsed: v.array(v.union(v.literal("learn"), v.literal("match"))),

    modeStats: v.optional(v.object({
      learn: v.object({
        total: v.number(),
        correct: v.number(),
        incorrect: v.number(),
      }),
      match: v.object({
        total: v.number(),
        correct: v.number(),
        incorrect: v.number(),
      }),
    })),

    categoryStats: v.optional(v.array(v.object({
      category: v.string(),
      total: v.number(),
      correct: v.number(),
      incorrect: v.number(),
    }))),

    // Integrity monitoring summary for suspicious-attempt analysis.
    hasIntegrityFlags: v.optional(v.boolean()),
    integrityScore: v.optional(v.number()),
    integritySeverity: v.optional(v.union(
      v.literal("low"),
      v.literal("medium"),
      v.literal("high")
    )),
    integritySignals: v.optional(v.object({
      expectedDurationMs: v.number(),
      actualDurationMs: v.number(),
      averageAnswerTimeMs: v.number(),
      answerTimeStdDevMs: v.number(),
      maxConsecutiveSameAnswer: v.number(),
      matchedRuleIds: v.array(v.string()),
      flags: v.array(v.object({
        ruleId: v.string(),
        severity: v.union(
          v.literal("low"),
          v.literal("medium"),
          v.literal("high")
        ),
        title: v.string(),
        description: v.string(),
      })),
    })),

    // Administrative invalidation metadata for suspicious or voided results.
    invalidated: v.optional(v.boolean()),
    invalidatedAt: v.optional(v.number()),
    invalidatedBy: v.optional(v.id("users")),
    invalidationReason: v.optional(v.union(
      v.literal("suspected_cheating"),
      v.literal("technical_issue_student_request"),
      v.literal("proctor_decision"),
      v.literal("other")
    )),
    invalidationReasonDetails: v.optional(v.string()),

    // Admin-entered investigation notes captured during integrity review.
    investigationNotes: v.optional(v.object({
      notes: v.string(),
      updatedAt: v.number(),
      updatedBy: v.id("users"),
    })),

    // Flag corpus provenance for integrity and audit investigations.
    flagDatabaseSnapshot: v.object({
      generationVersion: v.number(),
      examChecksum: v.string(),
      questionCount: v.number(),
      modeStrategy: v.union(v.literal("alternating"), v.literal("single")),
      singleMode: v.optional(v.union(v.literal("learn"), v.literal("match"))),
      generationStartedAt: v.number(),
      generationCompletedAt: v.number(),
      generationTimeMs: v.number(),
      generationRetryCount: v.number(),
    }),

    // Detailed immutable question-by-question record.
    questionBreakdown: v.array(v.object({
      questionIndex: v.number(),
      flagId: v.id("flags"),
      flagKey: v.string(),
      flagName: v.string(),
      flagImagePath: v.string(),
      category: v.string(),
      mode: v.union(v.literal("learn"), v.literal("match")),
      options: v.array(v.object({
        id: v.string(),
        label: v.string(),
        value: v.string(),
        imagePath: v.optional(v.string()),
      })),
      selectedAnswer: v.union(v.string(), v.null()),
      correctAnswer: v.string(),
      isCorrect: v.boolean(),
      answeredAt: v.optional(v.number()),
      responseTimeMs: v.optional(v.number()),
      questionChecksum: v.string(),
    })),

    // Tamper-evidence for the immutable record payload.
    recordChecksum: v.string(),
    signatureAlgorithm: v.string(),
    signature: v.string(),

    createdAt: v.number(),
  })
  .index("by_attempt", ["examAttemptId"])
  .index("by_user_completedAt", ["userId", "completedAt"])
  .index("by_completedAt", ["completedAt"])
  .index("by_certificate", ["certificateNumber"])
  .index("by_passed_completedAt", ["passed", "completedAt"])
  .index("by_integrity_flag_completedAt", ["hasIntegrityFlags", "completedAt"])
  .index("by_integrity_score_completedAt", ["integrityScore", "completedAt"])
  .index("by_invalidated_completedAt", ["invalidated", "completedAt"]),

  // Audit trail for all immutable result retrieval and verification accesses.
  examResultAccessLogs: defineTable({
    examResultId: v.id("examResults"),
    examAttemptId: v.id("examAttempts"),
    targetUserId: v.id("users"),
    actorUserId: v.id("users"),
    actorRole: v.union(
      v.literal("cadet"),
      v.literal("admin")
    ),
    accessType: v.union(
      v.literal("result_read"),
      v.literal("result_list"),
      v.literal("result_verify"),
      v.literal("result_access_denied"),
      v.literal("result_invalidated"),
      v.literal("result_note_updated")
    ),
    metadataJson: v.optional(v.string()),
    createdAt: v.number(),
  })
  .index("by_result_createdAt", ["examResultId", "createdAt"])
  .index("by_attempt_createdAt", ["examAttemptId", "createdAt"])
  .index("by_actor_createdAt", ["actorUserId", "createdAt"])
  .index("by_target_createdAt", ["targetUserId", "createdAt"]),

  // Generated official exam question records.
  examQuestions: defineTable({
    examAttemptId: v.id("examAttempts"),
    userId: v.id("users"),
    questionIndex: v.number(),
    flagId: v.id("flags"),
    flagKey: v.string(),
    mode: v.union(v.literal("learn"), v.literal("match")),

    options: v.array(v.object({
      id: v.string(),
      label: v.string(),
      value: v.string(),
      imagePath: v.optional(v.string()),
    })),

    // Server-trusted answer fields.
    correctAnswer: v.string(),
    userAnswer: v.union(v.string(), v.null()),
    answeredAt: v.optional(v.number()),
    isCorrect: v.optional(v.boolean()),

    // Basic tamper-detection support.
    checksum: v.string(),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
  .index("by_attempt", ["examAttemptId"])
  .index("by_attempt_question", ["examAttemptId", "questionIndex"])
  .index("by_user_attempt", ["userId", "examAttemptId"]),

  // Security and performance audit trail for official exams.
  examAuditLogs: defineTable({
    examAttemptId: v.id("examAttempts"),
    userId: v.id("users"),
    eventType: v.union(
      v.literal("generation_started"),
      v.literal("generation_completed"),
      v.literal("generation_failed"),
      v.literal("submission_received"),
      v.literal("submission_validated"),
      v.literal("submission_rejected"),
      v.literal("immutable_write_blocked"),
      v.literal("result_backfilled"),
      v.literal("session_token_issued"),
      v.literal("session_token_validated"),
      v.literal("session_token_rejected"),
      v.literal("connection_lost"),
      v.literal("connection_restored"),
      v.literal("window_blur"),
      v.literal("window_focus"),
      v.literal("tab_hidden"),
      v.literal("tab_visible"),
      v.literal("fullscreen_entered"),
      v.literal("fullscreen_exited"),
      v.literal("back_navigation_blocked"),
      v.literal("restricted_shortcut_blocked"),
      v.literal("idle_warning_shown"),
      v.literal("idle_timeout_triggered")
    ),
    message: v.string(),
    metadataJson: v.optional(v.string()),
    createdAt: v.number(),
  })
  .index("by_attempt_createdAt", ["examAttemptId", "createdAt"])
  .index("by_user_createdAt", ["userId", "createdAt"]),

  // Admin-controlled official exam generation settings.
  examSettings: defineTable({
    modeStrategy: v.union(v.literal("alternating"), v.literal("single")),
    singleMode: v.optional(v.union(v.literal("learn"), v.literal("match"))),
    integrityThresholds: v.optional(v.object({
      minAverageAnswerTimeMs: v.number(),
      maxConsecutiveSameAnswer: v.number(),
      minExpectedDurationRatioPercent: v.number(),
      minAnswerTimeStdDevMs: v.number(),
    })),
    updatedBy: v.id("users"),
    updatedAt: v.number(),
    createdAt: v.number(),
  })
  .index("by_updatedAt", ["updatedAt"]),

  // Global exam system configuration for runtime controls.
  systemConfig: defineTable({
    configKey: v.string(),
    examEnabled: v.boolean(),
    questionCount: v.number(),
    passThreshold: v.number(),
    availabilityWindow: v.object({
      startDate: v.string(),
      endDate: v.string(),
      startTime: v.string(),
      endTime: v.string(),
      timeZone: v.optional(v.string()),
    }),
    maxRetakes: v.number(),
    retakeCooldownHours: v.number(),
    maintenanceModeEnabled: v.boolean(),
    maintenanceMessage: v.optional(v.string()),
    updatedBy: v.id("users"),
    updatedAt: v.number(),
    createdAt: v.number(),
  })
  .index("by_configKey", ["configKey"])
  .index("by_updatedAt", ["updatedAt"]),

  // Admin-managed templates for quickly applying exam configurations.
  examTemplates: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    settings: v.object({
      examEnabled: v.boolean(),
      questionCount: v.number(),
      passThreshold: v.number(),
      availabilityWindow: v.object({
        startDate: v.string(),
        endDate: v.string(),
        startTime: v.string(),
        endTime: v.string(),
        timeZone: v.optional(v.string()),
      }),
      maxRetakes: v.number(),
      retakeCooldownHours: v.number(),
    }),
    archivedAt: v.optional(v.number()),
    archivedBy: v.optional(v.id("users")),
    updatedBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
  .index("by_updatedAt", ["updatedAt"])
  .index("by_archivedAt_updatedAt", ["archivedAt", "updatedAt"]),

  // Searchable audit records for administrative system management actions.
  adminActionLogs: defineTable({
    actorUserId: v.id("users"),
    actorRole: v.union(v.literal("admin"), v.literal("cadet"), v.literal("unknown")),
    actionType: v.union(
      v.literal("system_config_updated"),
      v.literal("maintenance_mode_enabled"),
      v.literal("maintenance_mode_disabled"),
      v.literal("exam_template_created"),
      v.literal("exam_template_updated"),
      v.literal("exam_template_archived")
    ),
    targetType: v.union(v.literal("system_config"), v.literal("exam_template")),
    targetId: v.optional(v.string()),
    outcome: v.union(v.literal("success"), v.literal("failure")),
    message: v.string(),
    metadataJson: v.optional(v.string()),
    createdAt: v.number(),
  })
  .index("by_createdAt", ["createdAt"])
  .index("by_actor_createdAt", ["actorUserId", "createdAt"])
  .index("by_action_createdAt", ["actionType", "createdAt"])
  .index("by_target_createdAt", ["targetType", "createdAt"])
  .index("by_outcome_createdAt", ["outcome", "createdAt"]),

  // Audit trail for admin page and API access attempts.
  adminAccessLogs: defineTable({
    actorUserId: v.optional(v.id("users")),
    actorClerkId: v.optional(v.string()),
    actorRole: v.union(
      v.literal("cadet"),
      v.literal("admin"),
      v.literal("unknown")
    ),
    surface: v.union(v.literal("page"), v.literal("api")),
    target: v.string(),
    method: v.optional(v.string()),
    outcome: v.union(v.literal("allowed"), v.literal("denied")),
    reason: v.optional(v.string()),
    metadataJson: v.optional(v.string()),
    createdAt: v.number(),
  })
  .index("by_createdAt", ["createdAt"])
  .index("by_surface_createdAt", ["surface", "createdAt"])
  .index("by_outcome_createdAt", ["outcome", "createdAt"]),

  // In-app notifications for user-facing system and admin events.
  notifications: defineTable({
    recipientUserId: v.id("users"),
    type: v.union(
      v.literal("exam_invalidated"),
      v.literal("role_changed"),
      v.literal("account_suspended"),
      v.literal("account_reactivated"),
      v.literal("account_banned"),
      v.literal("account_pending_verification"),
      v.literal("admin_message")
    ),
    title: v.string(),
    message: v.string(),
    metadataJson: v.optional(v.string()),
    readAt: v.optional(v.number()),
    createdAt: v.number(),
  })
  .index("by_recipient_createdAt", ["recipientUserId", "createdAt"])
  .index("by_recipient_readAt", ["recipientUserId", "readAt"]),

  // Ranked mode season metadata and lifecycle configuration.
  rankedSeasons: defineTable({
    slug: v.string(),
    name: v.string(),
    startsAt: v.number(),
    endsAt: v.optional(v.number()),
    status: v.union(
      v.literal("upcoming"),
      v.literal("active"),
      v.literal("completed"),
      v.literal("archived")
    ),
    description: v.optional(v.string()),
    createdBy: v.id("users"),
    updatedBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
  .index("by_slug", ["slug"])
  .index("by_status_startsAt", ["status", "startsAt"])
  .index("by_startsAt", ["startsAt"]),

  // Runtime ranked mode controls and anti-spam policies.
  rankedSystemConfig: defineTable({
    configKey: v.string(),
    rankedModeEnabled: v.boolean(),
    requiresPassedExam: v.boolean(),
    cooldownMinutes: v.number(),
    dailyAttemptLimit: v.optional(v.number()),
    weeklyAttemptLimit: v.optional(v.number()),
    updatedBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
  .index("by_configKey", ["configKey"])
  .index("by_updatedAt", ["updatedAt"]),

  // Immutable per-attempt records for ranked leaderboard and integrity review.
  rankedRuns: defineTable({
    userId: v.id("users"),
    seasonId: v.id("rankedSeasons"),
    status: v.union(
      v.literal("started"),
      v.literal("completed"),
      v.literal("abandoned"),
      v.literal("flagged")
    ),
    startedAt: v.number(),
    // Last accepted answer timestamp (server generated) for sequence/timing checks.
    lastAnsweredAt: v.optional(v.number()),
    // Expected next question index to enforce strict in-order submissions.
    nextExpectedQuestionIndex: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    finalizedAt: v.optional(v.number()),
    immutableAt: v.optional(v.number()),
    runDurationMs: v.optional(v.number()),
    totalElapsedMs: v.optional(v.number()),
    flagCount: v.number(),
    correctCount: v.number(),
    accuracyPercent: v.number(),
    score: v.number(),
    pointsFromTime: v.number(),
    pointsFromAccuracy: v.number(),
    antiCheatStatus: v.union(
      v.literal("clear"),
      v.literal("flagged"),
      v.literal("reviewing"),
      v.literal("disqualified")
    ),
    reviewStatus: v.union(
      v.literal("none"),
      v.literal("pending"),
      v.literal("confirmed"),
      v.literal("dismissed")
    ),
    suspiciousFlagsJson: v.optional(v.string()),
    suspiciousReason: v.optional(v.string()),
    // Highest-severity classification across suspiciousFlagsJson, mirroring the exam
    // integrity model's severity tiers for admin-review parity (FR-011a).
    suspiciousSeverity: v.optional(
      v.union(v.literal("low"), v.literal("medium"), v.literal("high"))
    ),
    // Simple weighted count of triggered soft-anomaly rules, for admin-review sorting.
    integrityScore: v.optional(v.number()),
    runChecksum: v.optional(v.string()),
    replayFingerprintHash: v.optional(v.string()),
    resultSignatureHash: v.optional(v.string()),
    resultTokenHash: v.optional(v.string()),
    resultSalt: v.optional(v.string()),
    signatureVersion: v.optional(v.string()),
    signatureIssuedAt: v.optional(v.number()),
    // Best-effort server-estimated network latency telemetry.
    averageNetworkLatencyEstimateMs: v.optional(v.number()),
    metadataJson: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
  .index("by_user_completedAt", ["userId", "completedAt"])
  .index("by_user_startedAt", ["userId", "startedAt"])
  .index("by_season_score", ["seasonId", "score"])
  .index("by_season_completedAt", ["seasonId", "completedAt"])
  .index("by_season_user_completedAt", ["seasonId", "userId", "completedAt"])
  .index("by_status_startedAt", ["status", "startedAt"])
  .index("by_anticheat_completedAt", ["antiCheatStatus", "completedAt"]),

  // Generated ranked question instances per timed run attempt.
  rankedQuestions: defineTable({
    runId: v.id("rankedRuns"),
    userId: v.id("users"),
    questionIndex: v.number(),
    flagId: v.id("flags"),
    flagKey: v.string(),
    mode: v.union(v.literal("learn"), v.literal("match")),

    options: v.array(v.object({
      id: v.string(),
      label: v.string(),
      value: v.string(),
      imagePath: v.optional(v.string()),
    })),

    // Server-trusted answer fields.
    correctAnswer: v.string(),
    userAnswer: v.union(v.string(), v.null()),
    serverReceivedAt: v.optional(v.number()),
    answeredAt: v.optional(v.number()),
    elapsedFromPreviousMs: v.optional(v.number()),
    elapsedFromStartMs: v.optional(v.number()),
    submissionSequenceValid: v.optional(v.boolean()),
    timingAnomalyCode: v.optional(v.string()),
    networkLatencyEstimateMs: v.optional(v.number()),
    isCorrect: v.optional(v.boolean()),
    responseTimeMs: v.optional(v.number()),
    responseIntegrityHash: v.optional(v.string()),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
  .index("by_run", ["runId"])
  .index("by_run_question", ["runId", "questionIndex"])
  .index("by_user_run", ["userId", "runId"]),

  // Immutable server-side timing and integrity event logs for ranked submissions.
  rankedTimingAudit: defineTable({
    runId: v.id("rankedRuns"),
    userId: v.id("users"),
    questionIndex: v.optional(v.number()),
    eventType: v.union(
      v.literal("submission_received"),
      v.literal("submission_accepted"),
      v.literal("submission_rejected"),
      v.literal("rate_limited"),
      v.literal("timing_flagged"),
      v.literal("run_finalized"),
      v.literal("replay_flagged"),
      v.literal("run_voided")
    ),
    requestReceivedAt: v.number(),
    referenceTimestamp: v.optional(v.number()),
    elapsedMs: v.optional(v.number()),
    clientReportedAt: v.optional(v.number()),
    serverClockOffsetMs: v.optional(v.number()),
    reason: v.optional(v.string()),
    metadataJson: v.optional(v.string()),
    createdAt: v.number(),
  })
  .index("by_run_createdAt", ["runId", "createdAt"])
  .index("by_user_createdAt", ["userId", "createdAt"])
  .index("by_event_createdAt", ["eventType", "createdAt"])
  .index("by_run_question_createdAt", ["runId", "questionIndex", "createdAt"]),

  // Snapshot records for server clock drift and client offset telemetry health.
  rankedClockHealth: defineTable({
    source: v.union(
      v.literal("submission"),
      v.literal("periodic"),
      v.literal("diagnostic")
    ),
    driftMs: v.number(),
    status: v.union(
      v.literal("ok"),
      v.literal("warning"),
      v.literal("critical")
    ),
    metadataJson: v.optional(v.string()),
    measuredAt: v.number(),
    createdAt: v.number(),
  })
  .index("by_createdAt", ["createdAt"])
  .index("by_status_createdAt", ["status", "createdAt"]),
});
