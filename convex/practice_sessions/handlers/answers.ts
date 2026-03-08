import { v } from "convex/values";
import { mutation } from "../../_generated/server";
import { getOwnedSession, requireAuthenticatedUser } from "../services/auth";
import { buildAnswerLabels, buildSimilarFlags } from "../services/feedback";

export const submitAnswer = mutation({
  args: {
    sessionId: v.id("practiceSessions"),
    questionIndex: v.number(),
    selectedAnswer: v.string(),
    timeSpent: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthenticatedUser(
      ctx,
      "Must be authenticated to submit answer"
    );

    const session = await getOwnedSession(
      ctx,
      user._id,
      args.sessionId,
      "Session not found"
    );

    if (session.status !== "active") {
      throw new Error(`Cannot submit answer for ${session.status} session`);
    }

    if (!session.questions || session.questions.length === 0) {
      throw new Error("Session has no questions");
    }

    if (args.questionIndex !== session.currentIndex) {
      throw new Error(
        `Question index mismatch. Expected ${session.currentIndex}, got ${args.questionIndex}`
      );
    }

    if (args.questionIndex >= session.questions.length) {
      throw new Error("Question index out of bounds");
    }

    const currentQuestion = session.questions[args.questionIndex];
    if (currentQuestion.userAnswer !== null) {
      throw new Error("Answer already submitted for this question");
    }

    const validOptionIds = currentQuestion.options.map((option) => option.id);
    if (!validOptionIds.includes(args.selectedAnswer)) {
      throw new Error(
        `Invalid option selected. Valid options: ${validOptionIds.join(", ")}`
      );
    }

    const isCorrect = args.selectedAnswer === currentQuestion.correctAnswer;

    const updatedQuestions = [...session.questions];
    updatedQuestions[args.questionIndex] = {
      ...currentQuestion,
      userAnswer: args.selectedAnswer,
    };

    const newCorrectCount = isCorrect
      ? session.correctCount + 1
      : session.correctCount;
    const newScore = Math.round((newCorrectCount / session.questions.length) * 100);

    let currentStreak = 0;
    for (let i = args.questionIndex; i >= 0; i--) {
      const question = updatedQuestions[i];
      if (question.userAnswer === question.correctAnswer) {
        currentStreak++;
      } else {
        break;
      }
    }

    const nextQuestionIndex = args.questionIndex + 1;
    const isSessionComplete = nextQuestionIndex >= session.questions.length;

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

    if (isSessionComplete) {
      updateData.status = "completed";
      updateData.completedAt = completedAt;
      updateData.timeTaken = completedAt - session.startedAt;
    }

    await ctx.db.patch(args.sessionId, updateData);

    const flag = await ctx.db.get(currentQuestion.flagId);
    if (!flag) {
      throw new Error("Flag not found for current question");
    }

    const allFlags = await ctx.db.query("flags").withIndex("by_order").collect();
    const similarFlags = buildSimilarFlags(flag, allFlags);
    const { userAnswerLabel, correctAnswerLabel } = buildAnswerLabels(
      currentQuestion,
      session.mode,
      args.selectedAnswer,
      flag.name
    );

    return {
      isCorrect,
      correctAnswer: currentQuestion.correctAnswer,
      currentStreak,
      score: newScore,
      correctCount: newCorrectCount,
      isSessionComplete,
      nextQuestionIndex: isSessionComplete ? undefined : nextQuestionIndex,
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
