import { v } from "convex/values";
import { mutation, query, QueryCtx } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { Question } from "./lib/types";
import { startTimer } from "./lib/performance";
import { distributeAnswerPositions, distributeAnswerPositionsSeeded } from "./lib/randomization";
import { generateLearnModeOptions, generateMatchModeOptions } from "./lib/distractor_generation";

/**
 * Helper: Randomly select N flags from all available flags
 */
async function selectRandomFlags(
  ctx: QueryCtx,
  count: number | "all"
): Promise<Id<"flags">[]> {
  const allFlags = await ctx.db
    .query("flags")
    .withIndex("by_order")
    .collect();

  if (allFlags.length === 0) {
    throw new Error("No flags available in database");
  }

  // If 'all', return all flag IDs
  if (count === "all") {
    return allFlags.map((flag: Doc<"flags">) => flag._id);
  }

  // Ensure we don't try to select more flags than available
  const actualCount = Math.min(count, allFlags.length);

  // Fisher-Yates shuffle and take first N
  const shuffled = [...allFlags];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled.slice(0, actualCount).map((flag: Doc<"flags">) => flag._id);
}

/**
 * Helper: Fetch full flag documents for question generation
 * Converts array of flag IDs to complete flag objects with all metadata.
 * 
 * @param ctx - Query context
 * @param flagIds - Array of flag IDs to fetch
 * @returns Array of complete flag documents
 * @throws Error if any flag is not found
 */
async function fetchFlagsForGeneration(
  ctx: QueryCtx,
  flagIds: Id<"flags">[]
): Promise<Doc<"flags">[]> {
  const flags: Doc<"flags">[] = [];

  for (const flagId of flagIds) {
    const flag = await ctx.db.get(flagId);
    if (!flag) {
      throw new Error(`Flag with ID ${flagId} not found`);
    }
    flags.push(flag);
  }

  return flags;
}

/**
 * Query: Get incomplete practice session for current user
 * Returns the most recent active session, or null if none exists
 */
export const getIncompleteSession = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user) {
      return null;
    }

    // Find most recent active session
    const activeSession = await ctx.db
      .query("practiceSessions")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", user._id).eq("status", "active")
      )
      .order("desc")
      .first();

    return activeSession;
  },
});

/**
 * Query: Get practice statistics for current user
 * Calculates total sessions, average score, last practiced date
 */
export const getUserPracticeStats = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user) {
      return null;
    }

    // Get all sessions for this user
    const allSessions = await ctx.db
      .query("practiceSessions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const completedSessions = allSessions.filter(
      (s) => s.status === "completed"
    );

    const totalSessions = allSessions.length;
    const completedCount = completedSessions.length;

    // Calculate average score from completed sessions
    let averageScore = 0;
    if (completedCount > 0) {
      const totalScore = completedSessions.reduce((sum, s) => sum + s.score, 0);
      averageScore = totalScore / completedCount;
    }

    // Find last practiced date
    const lastPracticed =
      allSessions.length > 0
        ? Math.max(...allSessions.map((s) => s.startedAt))
        : undefined;

    // Calculate total flags practiced
    const totalFlagsPracticed = completedSessions.reduce(
      (sum, s) => sum + s.flagIds.length,
      0
    );

    // Determine favorite mode
    const modeCount = completedSessions.reduce(
      (acc, s) => {
        acc[s.mode] = (acc[s.mode] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const favoriteMode =
      completedCount > 0
        ? (Object.keys(modeCount).sort(
          (a, b) => modeCount[b] - modeCount[a]
        )[0] as "learn" | "match")
        : undefined;

    return {
      totalSessions,
      completedSessions: completedCount,
      averageScore,
      lastPracticed,
      totalFlagsPracticed,
      favoriteMode,
    };
  },
});

/**
 * Query: Get specific practice session by ID
 * Only returns session if it belongs to the current user
 */
export const getSessionById = query({
  args: { sessionId: v.id("practiceSessions") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user) {
      return null;
    }

    const session = await ctx.db.get(args.sessionId);

    // Security: Only return session if it belongs to this user
    if (!session || session.userId !== user._id) {
      return null;
    }

    return session;
  },
});

/**
 * Query: Get current question with full flag data
 * Returns the current question for the active session with populated flag details.
 * Used by quiz interface to display question and options.
 */
export const getCurrentQuestion = query({
  args: { sessionId: v.id("practiceSessions") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Must be authenticated to get question");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user) {
      throw new Error("User not found");
    }

    // Fetch session
    const session = await ctx.db.get(args.sessionId);

    // Security: Only allow user to access their own session
    if (!session || session.userId !== user._id) {
      throw new Error("Session not found or access denied");
    }

    // Return null for non-active sessions (completed, abandoned)
    if (session.status !== "active") {
      return null;
    }

    // Check for questions array (backward compatibility)
    if (!session.questions || session.questions.length === 0) {
      throw new Error("Session has no questions. This may be a legacy session.");
    }

    // Check if session is complete
    if (session.currentIndex >= session.questions.length) {
      return null; // Session complete
    }

    // Get current question
    const currentQuestion = session.questions[session.currentIndex];

    // Fetch full flag document
    const flag = await ctx.db.get(currentQuestion.flagId);
    if (!flag) {
      throw new Error(`Flag not found for question`);
    }

    // Calculate progress stats
    const answeredQuestions = session.questions.slice(0, session.currentIndex);
    const correctCount = answeredQuestions.filter(
      q => q.userAnswer === q.correctAnswer
    ).length;
    const incorrectCount = answeredQuestions.length - correctCount;

    // Calculate current streak
    let streak = 0;
    for (let i = session.currentIndex - 1; i >= 0; i--) {
      const q = session.questions[i];
      if (q.userAnswer === q.correctAnswer) {
        streak++;
      } else {
        break;
      }
    }

    const accuracy =
      answeredQuestions.length > 0
        ? Math.round((correctCount / answeredQuestions.length) * 100)
        : 0;

    return {
      question: currentQuestion,
      flag: {
        _id: flag._id,
        key: flag.key,
        type: flag.type,
        name: flag.name,
        meaning: flag.meaning,
        imagePath: flag.imagePath,
        colors: flag.colors,
        description: flag.description,
      },
      questionIndex: session.currentIndex,
      totalQuestions: session.questions.length,
      progress: {
        currentIndex: session.currentIndex,
        totalQuestions: session.questions.length,
        correctCount,
        incorrectCount,
        streak,
        accuracy,
        questionsRemaining: session.questions.length - session.currentIndex,
      },
    };
  },
});

/**
 * Mutation: Create new practice session with randomized questions
 * Generates complete question set with shuffled multiple-choice options.
 * Includes performance monitoring and error handling.
 */
export const createPracticeSession = mutation({
  args: {
    mode: v.union(v.literal("learn"), v.literal("match")),
    sessionLength: v.union(
      v.literal(5),
      v.literal(10),
      v.literal(15),
      v.literal(30),
      v.literal("all")
    ),
    randomSeed: v.optional(v.number()), // Optional seed for deterministic testing
  },
  handler: async (ctx, args) => {
    // START PERFORMANCE MONITORING
    const timer = startTimer();

    // 1. AUTHENTICATE USER
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Must be authenticated to create practice session");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user) {
      throw new Error("User not found");
    }

    // 2. CHECK FOR EXISTING ACTIVE SESSION
    const existingActiveSession = await ctx.db
      .query("practiceSessions")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", user._id).eq("status", "active")
      )
      .first();

    if (existingActiveSession) {
      throw new Error(
        "You already have an active practice session. Please complete or abandon it first."
      );
    }

    // 3. SELECT RANDOM FLAGS
    const flagIds = await selectRandomFlags(ctx, args.sessionLength);

    if (flagIds.length === 0) {
      throw new Error("No flags available for practice");
    }

    // 4. FETCH FULL FLAG DOCUMENTS
    const selectedFlags = await fetchFlagsForGeneration(ctx, flagIds);

    // Get all flags for distractor generation
    const allFlags = await ctx.db
      .query("flags")
      .withIndex("by_order")
      .collect();

    // ERROR HANDLING: Ensure sufficient flags for question generation
    if (allFlags.length < 4) {
      throw new Error(
        `Insufficient flags for question generation. Need at least 4 flags, but only ${allFlags.length} available.`
      );
    }

    // 5. GENERATE ANSWER POSITION DISTRIBUTION
    const answerPositions = args.randomSeed
      ? distributeAnswerPositionsSeeded(selectedFlags.length, args.randomSeed)
      : distributeAnswerPositions(selectedFlags.length);

    // 6. GENERATE QUESTIONS WITH SHUFFLED OPTIONS
    const questions: Question[] = [];

    for (let i = 0; i < selectedFlags.length; i++) {
      const targetFlag = selectedFlags[i];
      const correctPosition = answerPositions[i];

      try {
        // Generate options based on practice mode
        const { options, correctAnswer } = args.mode === "learn"
          ? generateLearnModeOptions(targetFlag, allFlags, correctPosition)
          : generateMatchModeOptions(targetFlag, allFlags, correctPosition);

        // Build question object
        const question: Question = {
          flagId: targetFlag._id,
          questionType: args.mode,
          options,
          correctAnswer,
          userAnswer: null,
        };

        questions.push(question);
      } catch (error) {
        // Log error but provide helpful message
        console.error(`Error generating question for flag ${targetFlag.key}:`, error);
        throw new Error(
          `Failed to generate questions. Please try again with a smaller session size.`
        );
      }
    }

    // 7. CALCULATE GENERATION TIME
    const generationTime = timer.elapsed();

    // 8. LOG PERFORMANCE WARNING IF EXCEEDED THRESHOLD
    if (generationTime > 2000) {
      console.warn(
        `[Performance Warning] Question generation took ${generationTime}ms (threshold: 2000ms) for ${questions.length} questions`
      );
    } else {
      console.log(
        `[Performance] Generated ${questions.length} questions in ${generationTime}ms`
      );
    }

    // 9. CREATE SESSION WITH QUESTIONS
    const sessionId = await ctx.db.insert("practiceSessions", {
      userId: user._id,
      mode: args.mode,
      sessionLength: args.sessionLength === "all" ? flagIds.length : args.sessionLength,
      flagIds,
      currentIndex: 0,
      score: 0,
      correctCount: 0,
      status: "active",
      startedAt: Date.now(),
      questions,
      generationTime,
    });

    return sessionId;
  },
});

/**
 * Mutation: Abandon incomplete practice session
 * Marks session as abandoned so user can start a new one
 */
export const abandonSession = mutation({
  args: { sessionId: v.id("practiceSessions") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Must be authenticated to abandon session");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user) {
      throw new Error("User not found");
    }

    const session = await ctx.db.get(args.sessionId);

    if (!session) {
      throw new Error("Session not found");
    }

    // Security: Only allow user to abandon their own session
    if (session.userId !== user._id) {
      throw new Error("You can only abandon your own sessions");
    }

    // Only active sessions can be abandoned
    if (session.status !== "active") {
      throw new Error("Only active sessions can be abandoned");
    }

    // Mark as abandoned
    await ctx.db.patch(args.sessionId, {
      status: "abandoned",
      completedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Mutation: Update session progress (for future use in actual practice interface)
 * Updates current index and score as user progresses through session
 */
export const updateSessionProgress = mutation({
  args: {
    sessionId: v.id("practiceSessions"),
    currentIndex: v.number(),
    score: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Must be authenticated to update session");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user) {
      throw new Error("User not found");
    }

    const session = await ctx.db.get(args.sessionId);

    if (!session) {
      throw new Error("Session not found");
    }

    // Security: Only allow user to update their own session
    if (session.userId !== user._id) {
      throw new Error("You can only update your own sessions");
    }

    if (session.status !== "active") {
      throw new Error("Can only update active sessions");
    }

    await ctx.db.patch(args.sessionId, {
      currentIndex: args.currentIndex,
      score: args.score,
    });

    return { success: true };
  },
});

/**
 * Mutation: Complete practice session (for future use in actual practice interface)
 * Marks session as completed with final score
 */
export const completeSession = mutation({
  args: {
    sessionId: v.id("practiceSessions"),
    finalScore: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Must be authenticated to complete session");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user) {
      throw new Error("User not found");
    }

    const session = await ctx.db.get(args.sessionId);

    if (!session) {
      throw new Error("Session not found");
    }

    // Security: Only allow user to complete their own session
    if (session.userId !== user._id) {
      throw new Error("You can only complete your own sessions");
    }

    if (session.status !== "active") {
      throw new Error("Can only complete active sessions");
    }

    await ctx.db.patch(args.sessionId, {
      status: "completed",
      score: args.finalScore,
      currentIndex: session.flagIds.length, // Mark as fully completed
      completedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Mutation: Submit answer for current question
 * Records user's answer, validates correctness, updates score and progress.
 * Advances to next question or marks session as complete.
 */
export const submitAnswer = mutation({
  args: {
    sessionId: v.id("practiceSessions"),
    questionIndex: v.number(),
    selectedAnswer: v.string(), // Option ID (e.g., "opt_1")
    timeSpent: v.optional(v.number()), // Optional: ms spent on question
  },
  handler: async (ctx, args) => {
    // 1. AUTHENTICATE USER
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Must be authenticated to submit answer");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user) {
      throw new Error("User not found");
    }

    // 2. FETCH SESSION
    const session = await ctx.db.get(args.sessionId);

    if (!session) {
      throw new Error("Session not found");
    }

    // 3. SECURITY CHECK
    if (session.userId !== user._id) {
      throw new Error("You can only submit answers for your own sessions");
    }

    // 4. VALIDATE SESSION STATE
    if (session.status !== "active") {
      throw new Error(`Cannot submit answer for ${session.status} session`);
    }

    if (!session.questions || session.questions.length === 0) {
      throw new Error("Session has no questions");
    }

    // 5. VALIDATE QUESTION INDEX
    if (args.questionIndex !== session.currentIndex) {
      throw new Error(
        `Question index mismatch. Expected ${session.currentIndex}, got ${args.questionIndex}`
      );
    }

    if (args.questionIndex >= session.questions.length) {
      throw new Error("Question index out of bounds");
    }

    // 6. GET CURRENT QUESTION
    const currentQuestion = session.questions[args.questionIndex];

    // 7. VALIDATE ANSWER NOT ALREADY SUBMITTED
    if (currentQuestion.userAnswer !== null) {
      throw new Error("Answer already submitted for this question");
    }

    // 8. VALIDATE SELECTED ANSWER IS VALID OPTION
    const validOptionIds = currentQuestion.options.map(opt => opt.id);
    if (!validOptionIds.includes(args.selectedAnswer)) {
      throw new Error(
        `Invalid option selected. Valid options: ${validOptionIds.join(", ")}`
      );
    }

    // 9. CHECK IF ANSWER IS CORRECT
    const isCorrect = args.selectedAnswer === currentQuestion.correctAnswer;

    // 10. UPDATE QUESTIONS ARRAY
    const updatedQuestions = [...session.questions];
    updatedQuestions[args.questionIndex] = {
      ...currentQuestion,
      userAnswer: args.selectedAnswer,
    };

    // 11. CALCULATE NEW SCORE AND COUNTS
    const newCorrectCount = isCorrect ? session.correctCount + 1 : session.correctCount;
    const totalAnswered = args.questionIndex + 1;
    const newScore = Math.round((newCorrectCount / session.questions.length) * 100);

    // 12. CALCULATE STREAK
    let currentStreak = 0;
    for (let i = args.questionIndex; i >= 0; i--) {
      const q = updatedQuestions[i];
      if (q.userAnswer === q.correctAnswer) {
        currentStreak++;
      } else {
        break;
      }
    }

    // 13. ADVANCE TO NEXT QUESTION
    const nextQuestionIndex = args.questionIndex + 1;
    const isSessionComplete = nextQuestionIndex >= session.questions.length;

    // 14. UPDATE SESSION
    const completedAt = Date.now();
    const updateData: {
      questions: typeof updatedQuestions;
      correctCount: number;
      score: number;
      currentIndex: number;
      status?: "active" | "completed";
      completedAt?: number;
      timeTaken?: number;
    } = {
      questions: updatedQuestions,
      correctCount: newCorrectCount,
      score: newScore,
      currentIndex: nextQuestionIndex,
    };

    // Mark session as completed if this was the last question
    if (isSessionComplete) {
      updateData.status = "completed";
      updateData.completedAt = completedAt;
      updateData.timeTaken = completedAt - session.startedAt;
    }

    await ctx.db.patch(args.sessionId, updateData);

    // 15. FETCH FLAG DETAILS FOR FEEDBACK MODAL
    const flag = await ctx.db.get(currentQuestion.flagId);
    if (!flag) {
      throw new Error("Flag not found for current question");
    }

    // 16. FETCH SIMILAR FLAGS (for "confusable flags" section)
    const similarFlagsData = await ctx.db
      .query("flags")
      .withIndex("by_order")
      .collect();

    // Filter out the current flag
    const otherFlags = similarFlagsData.filter(f => f._id !== currentQuestion.flagId);

    // Calculate similarity scores
    const flagsWithScores = otherFlags.map(otherFlag => {
      let similarityScore = 0;

      // Same type flags are more likely to be confused
      if (otherFlag.type === flag.type) {
        similarityScore += 3;
      }

      // Same category is another strong similarity indicator
      if (otherFlag.category === flag.category) {
        similarityScore += 2;
      }

      // Count shared colors
      const sharedColors = otherFlag.colors.filter(color =>
        flag.colors.includes(color)
      ).length;
      similarityScore += sharedColors * 2;

      // Same pattern is highly confusable
      if (otherFlag.pattern && flag.pattern && otherFlag.pattern === flag.pattern) {
        similarityScore += 4;
      }

      // Similar difficulty level
      if (otherFlag.difficulty === flag.difficulty) {
        similarityScore += 1;
      }

      return {
        flag: otherFlag,
        similarityScore,
      };
    });

    // Get top 3-4 most similar flags
    const similarFlags = flagsWithScores
      .filter(item => item.similarityScore > 0)
      .sort((a, b) => b.similarityScore - a.similarityScore)
      .slice(0, 4)
      .map(item => ({
        _id: item.flag._id,
        key: item.flag.key,
        name: item.flag.name,
        imagePath: item.flag.imagePath,
        matchReason: item.similarityScore >= 5
          ? "Similar colors and pattern"
          : item.similarityScore >= 3
            ? "Same type"
            : "Similar appearance",
      }));

    // 17. GET ANSWER LABELS
    const userAnswerOption = currentQuestion.options.find(
      opt => opt.id === args.selectedAnswer
    );
    const correctAnswerOption = currentQuestion.options.find(
      opt => opt.id === currentQuestion.correctAnswer
    );

    // Determine label based on question type
    const userAnswerLabel = userAnswerOption
      ? (session.mode === "match" ? userAnswerOption.value : userAnswerOption.label)
      : "Unknown";
    const correctAnswerLabel = correctAnswerOption
      ? (session.mode === "match" ? correctAnswerOption.value : correctAnswerOption.label)
      : flag.name;

    // 18. RETURN EXTENDED RESULT
    return {
      // Existing fields
      isCorrect,
      correctAnswer: currentQuestion.correctAnswer,
      currentStreak,
      score: newScore,
      correctCount: newCorrectCount,
      isSessionComplete,
      nextQuestionIndex: isSessionComplete ? undefined : nextQuestionIndex,

      // New fields for FeedbackModal
      flag: {
        _id: flag._id,
        key: flag.key,
        type: flag.type,
        category: flag.category,
        name: flag.name,
        meaning: flag.meaning,
        description: flag.description,
        imagePath: flag.imagePath,
        colors: flag.colors,
        pattern: flag.pattern,
        tips: flag.tips,
        phonetic: flag.phonetic,
        difficulty: flag.difficulty,
        order: flag.order,
      },
      similarFlags,
      userAnswerLabel,
      correctAnswerLabel,
    };
  },
});
