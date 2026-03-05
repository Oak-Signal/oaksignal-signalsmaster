"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { ArrowLeft, ArrowRight, CheckCircle, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { QuizContainer } from "@/components/practice/quiz-container";
import { FlagDisplay } from "@/components/practice/flag-display";
import { QuizLoadingState } from "@/components/practice/quiz-loading-state";

interface ReviewMistakesClientProps {
  sessionId: Id<"practiceSessions">;
}

export function ReviewMistakesClient({ sessionId }: ReviewMistakesClientProps) {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);

  const session = useQuery(api.analytics.getSessionResults, { sessionId });

  if (session === undefined) {
    return (
      <QuizContainer>
        <QuizLoadingState className="mt-8" />
      </QuizContainer>
    );
  }

  if (session === null) {
    return (
      <QuizContainer>
        <div className="flex flex-col items-center justify-center h-[50vh] text-center space-y-4">
          <h2 className="text-2xl font-bold">Session Not Found</h2>
          <p className="text-muted-foreground">This practice session doesn&apos;t exist or you don&apos;t have access to it.</p>
          <Button onClick={() => router.push('/dashboard/practice')}>Return to Practice</Button>
        </div>
      </QuizContainer>
    );
  }

  const missedQuestions = session.questions.filter((q) => !q.isCorrect);

  if (missedQuestions.length === 0) {
    return (
      <QuizContainer>
        <div className="flex flex-col items-center justify-center p-12 text-center space-y-6">
          <CheckCircle className="w-16 h-16 text-green-500" />
          <h2 className="text-2xl font-bold">No Mistakes to Review!</h2>
          <p className="text-muted-foreground">You got a perfect score on this session.</p>
          <Button onClick={() => router.push(`/dashboard/practice/session/${sessionId}/results`)}>
            Back to Results
          </Button>
        </div>
      </QuizContainer>
    );
  }

  const currentQuestion = missedQuestions[currentIndex];
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === missedQuestions.length - 1;

  const handleNext = () => {
    if (!isLast) setCurrentIndex((i) => i + 1);
  };

  const handlePrev = () => {
    if (!isFirst) setCurrentIndex((i) => i - 1);
  };

  const handleDone = () => {
    router.push(`/dashboard/practice/session/${sessionId}/results`);
  };

  return (
    <QuizContainer>
      <div className="flex items-center justify-between mb-2">
        <Button variant="ghost" size="sm" onClick={handleDone} className="gap-2">
          <ArrowLeft className="w-4 h-4" /> Back to Results
        </Button>
        <div className="text-sm font-medium text-muted-foreground">
          Mistake {currentIndex + 1} of {missedQuestions.length}
        </div>
      </div>

      <div className="space-y-6">
        <FlagDisplay
          mode={currentQuestion.questionType}
          flagImage={currentQuestion.flagImagePath}
          flagName={currentQuestion.flagName}
          flagMeaning={currentQuestion.flagMeaning}
        />

        <Card className="border-destructive/20 bg-destructive/5 rounded-xl">
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold mb-4 text-center">Correct Answer</h3>
            
            <div className="grid md:grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-background border flex items-start gap-3">
                <XCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm text-muted-foreground font-medium mb-1">You Answered</div>
                  <div className="text-destructive font-medium line-through">
                    {currentQuestion.userAnswerLabel || "Skip / Time Out"}
                  </div>
                </div>
              </div>
              
              <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20 flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm text-green-700 font-medium mb-1">Correct Answer</div>
                  <div className="text-green-800 font-bold">
                    {currentQuestion.correctAnswerLabel}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-between items-center pt-4">
          <Button 
            variant="outline" 
            onClick={handlePrev} 
            disabled={isFirst}
            className="w-30"
          >
            <ArrowLeft className="w-4 h-4 mr-2" /> Previous
          </Button>

          {isLast ? (
            <Button onClick={handleDone} className="w-30">
              Done
            </Button>
          ) : (
            <Button onClick={handleNext} className="w-30">
              Next <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          )}
        </div>
      </div>
    </QuizContainer>
  );
}
