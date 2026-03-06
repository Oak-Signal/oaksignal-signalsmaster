import { Id } from "@/convex/_generated/dataModel"
import { ExamAttemptClient } from "./exam-attempt-client"

interface ExamAttemptPageProps {
  params: Promise<{ attemptId: string }>
}

export default async function ExamAttemptPage({ params }: ExamAttemptPageProps) {
  const { attemptId } = await params
  const id = attemptId as Id<"examAttempts">

  return <ExamAttemptClient attemptId={id} />
}

export function generateMetadata() {
  return {
    title: "Official Exam Attempt | Signals Master",
    description: "Review your active official exam attempt details.",
  }
}
