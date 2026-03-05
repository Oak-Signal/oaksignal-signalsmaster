"use client"

/**
 * Quiz Interface Component
 * Main orchestrator for interactive quiz experience
 * Integrates all quiz components and manages the complete flow
 */

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"

// Components
import { QuizContainer } from "./quiz-container"
import { QuizProgressBar } from "./quiz-progress-bar"
import { QuestionCounter } from "./question-counter"
import { StreakIndicator } from "./streak-indicator"
import { FlagDisplay } from "./flag-display"
import { MultipleChoiceOptions } from "./multiple-choice-options"
import { SubmitButton } from "./submit-button"
import { FeedbackModal } from "./feedback-modal"
import { CelebrationAnimation, PerfectScoreCelebration } from "./celebration-animation"
import { QuizLoadingState } from "./quiz-loading-state"
import { QuizErrorBoundary } from "./quiz-error-boundary"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertCircle, ArrowLeft } from "lucide-react"

// Hooks & Utils
import { useQuizState } from "@/hooks/use-quiz-state"
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts"
import { shouldCelebrate } from "@/lib/quiz-utils"
import type { FlagDetails, SimilarFlagData, AnswerFeedbackContext } from "@/lib/feedback-types"
import Link from "next/link"

interface QuizInterfaceProps {
  sessionId: Id<"practiceSessions">
}

function QuizInterfaceContent({ sessionId }: QuizInterfaceProps) {
  const router = useRouter()

  // Fetch session and current question
  const session = useQuery(api.practice_sessions.getSessionById, { sessionId })
  const questionData = useQuery(api.practice_sessions.getCurrentQuestion, { sessionId })
  
  // Mutations
  const submitAnswerMutation = useMutation(api.practice_sessions.submitAnswer)

  // Feedback modal state
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false)
  const [feedbackData, setFeedbackData] = useState<{
    context: AnswerFeedbackContext
    flag: FlagDetails
    similarFlags: SimilarFlagData[]
    userAnswerLabel: string
    correctAnswerLabel: string
  } | null>(null)

  // Quiz state management
  const quizState = useQuizState({
    totalQuestions: questionData?.totalQuestions || 0,
    currentQuestionIndex: questionData?.questionIndex || 0,
    onAnswerSubmit: async (selectedAnswer: string) => {
      if (!questionData) return

      try {
        const result = await submitAnswerMutation({
          sessionId,
          questionIndex: questionData.questionIndex,
          selectedAnswer,
        })

        // Update quiz state with result
        quizState.setAnswerResult(
          result.isCorrect,
          result.correctAnswer,
          result.currentStreak
        )

        // Store feedback data and open modal
        if (result.flag && questionData) {
          setFeedbackData({
            context: {
              isCorrect: result.isCorrect,
              userAnswer: selectedAnswer,
              correctAnswer: result.correctAnswer,
              currentStreak: result.currentStreak,
              score: result.score,
              correctCount: result.correctCount,
              totalQuestions: questionData.totalQuestions,
              currentQuestionIndex: questionData.questionIndex,
              isLastQuestion: result.isSessionComplete,
            },
            flag: result.flag,
            similarFlags: result.similarFlags || [],
            userAnswerLabel: result.userAnswerLabel,
            correctAnswerLabel: result.correctAnswerLabel,
          })
          setFeedbackModalOpen(true)
        }
      } catch (error) {
        console.error("Error submitting answer:", error)
        quizState.setSubmitting(false)
      }
    },
  })

  // Feedback modal handlers
  const handleNextQuestion = () => {
    setFeedbackModalOpen(false)
    setFeedbackData(null)
    quizState.resetForNextQuestion()
  }

  const handleViewResults = () => {
    setFeedbackModalOpen(false)
    setFeedbackData(null)
    router.push(`/dashboard/practice/session/${sessionId}/results`)
  }

  useEffect(() => {
    if (!session || questionData !== null) return
    router.replace(`/dashboard/practice/session/${sessionId}/results`)
  }, [session, questionData, router, sessionId])

  // Keyboard shortcuts
  useKeyboardShortcuts({
    enabled: !quizState.isAnswered && !quizState.isSubmitting && !feedbackModalOpen,
    hasSelection: !!quizState.selectedAnswer,
    onSelectOption: (index) => {
      if (questionData?.question.options[index]) {
        quizState.selectAnswer(questionData.question.options[index].id)
      }
    },
    onSubmit: quizState.submitAnswer,
  })

  // Determine if celebration should trigger
  const triggerCelebration = 
    quizState.isCorrect === true &&
    shouldCelebrate(
      true,
      quizState.streak,
      questionData?.progress.accuracy || 0
    )

  // Loading state
  if (session === undefined || questionData === undefined) {
    return (
      <QuizContainer>
        <QuizLoadingState />
      </QuizContainer>
    )
  }

  // Session not found or access denied
  if (!session) {
    return (
      <QuizContainer>
        <Card>
          <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground" />
            <div>
              <h3 className="text-lg font-semibold">Session Not Found</h3>
              <p className="text-sm text-muted-foreground mt-1">
                This practice session doesn&apos;t exist or you don&apos;t have access to it.
              </p>
            </div>
            <Button asChild>
              <Link href="/dashboard/practice">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Practice Selection
              </Link>
            </Button>
          </CardContent>
        </Card>
      </QuizContainer>
    )
  }

  // Session complete
  if (!questionData) {
    return (
      <QuizContainer>
        <QuizLoadingState className="mt-8" />
        <PerfectScoreCelebration trigger={session.score === 100} />
      </QuizContainer>
    )
  }

  const { question, flag, progress } = questionData

  return (
    <QuizContainer>
      {/* Header: Progress + Question Counter + Streak */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <QuestionCounter
          currentIndex={progress.currentIndex}
          totalQuestions={progress.totalQuestions}
        />
        <StreakIndicator streak={progress.streak} />
      </div>

      <QuizProgressBar
        currentIndex={progress.currentIndex}
        totalQuestions={progress.totalQuestions}
      />

      {/* Flag Display */}
      <FlagDisplay
        mode={question.questionType}
        flagImage={flag.imagePath}
        flagName={flag.name}
        flagMeaning={flag.meaning}
      />

      {/* Multiple Choice Options */}
      <MultipleChoiceOptions
        options={question.options}
        selectedAnswer={quizState.selectedAnswer}
        correctAnswer={quizState.isAnswered ? question.correctAnswer : undefined}
        isDisabled={quizState.isAnswered || quizState.isSubmitting}
        onSelect={quizState.selectAnswer}
        mode={question.questionType}
      />

      {/* Submit Button */}
      <div className="flex justify-center">
        <SubmitButton
          disabled={!quizState.selectedAnswer}
          isLoading={quizState.isSubmitting}
          isSuccess={quizState.isAnswered && quizState.isCorrect === true}
          onClick={quizState.submitAnswer}
        />
      </div>

      {/* Feedback Modal */}
      {feedbackData && (
        <FeedbackModal
          open={feedbackModalOpen}
          onOpenChange={setFeedbackModalOpen}
          feedback={feedbackData.context}
          flag={feedbackData.flag}
          similarFlags={feedbackData.similarFlags}
          userAnswerLabel={feedbackData.userAnswerLabel}
          correctAnswerLabel={feedbackData.correctAnswerLabel}
          onNext={handleNextQuestion}
          onViewResults={feedbackData.context.isLastQuestion ? handleViewResults : undefined}
          showSimilarFlags={true}
          showMnemonicTips={true}
          showLearnMoreLink={true}
        />
      )}

      {/* Celebration Animation */}
      <CelebrationAnimation
        trigger={triggerCelebration}
        intensity={quizState.streak >= 5 ? "high" : "medium"}
      />

      {/* Keyboard Shortcut Hint */}
      <div className="text-center text-xs text-muted-foreground">
        <p>Keyboard shortcuts: Press 1-4 to select, Enter to submit</p>
      </div>
    </QuizContainer>
  )
}

export function QuizInterface(props: QuizInterfaceProps) {
  return (
    <QuizErrorBoundary>
      <QuizInterfaceContent {...props} />
    </QuizErrorBoundary>
  )
}
