import { Id } from "@/convex/_generated/dataModel"
import { ReviewMistakesClient } from "@/components/results/review-mistakes-client"

interface ReviewPageProps {
  params: Promise<{ sessionId: string }>
}

export const metadata = {
  title: "Review Mistakes | Signals Master",
  description: "Review and learn from your incorrect answers.",
}

export default async function ReviewPage({ params }: ReviewPageProps) {
  const { sessionId } = await params;
  const id = sessionId as Id<"practiceSessions">;

  return <ReviewMistakesClient sessionId={id} />
}
