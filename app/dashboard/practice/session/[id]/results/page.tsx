import { Id } from "@/convex/_generated/dataModel"
import { ResultsPageClient } from "@/components/results/results-page-client"

interface ResultsPageProps {
    params: Promise<{ id: string }>
}

/**
 * Results page — server component wrapper.
 * Reads the session ID from the route and renders the client orchestrator.
 * All data fetching happens client-side via Convex's useQuery.
 */
export default async function ResultsPage({ params }: ResultsPageProps) {
    const { id } = await params
    const sessionId = id as Id<"practiceSessions">

    return <ResultsPageClient sessionId={sessionId} />
}

export function generateMetadata() {
    return {
        title: "Session Results | Signals Master",
        description: "Review your practice session results and track your progress.",
    }
}
