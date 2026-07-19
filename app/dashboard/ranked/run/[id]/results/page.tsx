import { RankedResultsClient } from "@/components/ranked/ranked-results-client";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function RankedResultsPage({ params }: PageProps) {
  const { id } = await params;
  return <RankedResultsClient runId={id} />;
}
