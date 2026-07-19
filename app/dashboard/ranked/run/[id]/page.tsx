import { RankedQuizInterface } from "@/components/ranked/ranked-quiz-interface";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function RankedRunPage({ params }: PageProps) {
  const { id } = await params;
  return <RankedQuizInterface runId={id} />;
}
