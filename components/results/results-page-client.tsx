"use client"

/**
 * ResultsPageClient
 * Client-side orchestrator for the results page.
 * Fetches session results via Convex and composes the full results UI.
 * Handles loading, error, and not-found states.
 */

import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"
import { AlertCircle, Loader2 } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ResultsHeader } from "./results-header"
import { QuestionReviewList } from "./question-review-list"
import { ResultsActions } from "./results-actions"

interface ResultsPageClientProps {
    sessionId: Id<"practiceSessions">
}

export function ResultsPageClient({ sessionId }: ResultsPageClientProps) {
    const result = useQuery(api.analytics.getSessionResults, { sessionId })

    // Loading state
    if (result === undefined) {
        return (
            <div
                className="flex min-h-100 flex-col items-center justify-center gap-3 text-muted-foreground"
                role="status"
                aria-live="polite"
                aria-label="Loading results"
            >
                <Loader2 className="h-8 w-8 animate-spin" aria-hidden="true" />
                <p className="text-sm">Loading your results&hellip;</p>
            </div>
        )
    }

    // Not found / access denied / not completed
    if (!result) {
        return (
            <div className="flex min-h-100 flex-col items-center justify-center gap-4">
                <Card className="w-full max-w-md">
                    <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
                        <AlertCircle
                            className="h-10 w-10 text-muted-foreground"
                            aria-hidden="true"
                        />
                        <div>
                            <h2 className="text-lg font-semibold">Results Not Found</h2>
                            <p className="mt-1 text-sm text-muted-foreground">
                                This session doesn&apos;t exist, hasn&apos;t been completed
                                yet, or you don&apos;t have access to it.
                            </p>
                        </div>
                        <Button asChild>
                            <Link href="/dashboard/practice">Back to Practice</Link>
                        </Button>
                    </CardContent>
                </Card>
            </div>
        )
    }

    const isPerfect = result.score === 100

    return (
        <div className="mx-auto w-full max-w-2xl space-y-8 py-8 px-4">
            {/* Score hero */}
            <ResultsHeader result={result} />

            <div className="h-px w-full bg-border" />

            {/* Per-question breakdown */}
            <QuestionReviewList questions={result.questions} />

            <div className="h-px w-full bg-border" />

            {/* CTA buttons */}
            <ResultsActions
                sessionId={sessionId}
                isPerfect={isPerfect}
            />
        </div>
    )
}
