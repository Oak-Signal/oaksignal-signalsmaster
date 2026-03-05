"use client"

/**
 * ResultsActions
 * CTA button group at the bottom of the results page:
 * - Practice Again → /dashboard/practice
 * - Review Mistakes → /dashboard/practice/review/[sessionId]  (disabled if 100%)
 * - View Analytics → /dashboard/analytics
 */

import Link from "next/link"
import { RotateCcw, BookOpen, BarChart2 } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ResultsActionsProps {
    sessionId: string
    isPerfect: boolean
}

export function ResultsActions({ sessionId, isPerfect }: ResultsActionsProps) {
    return (
        <div
            className="flex flex-col sm:flex-row items-center justify-center gap-3"
            role="group"
            aria-label="Session actions"
        >
            {/* Practice Again */}
            <Button asChild size="lg" className="w-full sm:w-auto">
                <Link href="/dashboard/practice">
                    <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />
                    Practice Again
                </Link>
            </Button>

            {/* Review Mistakes — disabled when score is 100% */}
            <Button
                asChild={!isPerfect}
                variant="outline"
                size="lg"
                className="w-full sm:w-auto"
                disabled={isPerfect}
                aria-disabled={isPerfect}
                aria-label={
                    isPerfect
                        ? "Review Mistakes (no mistakes to review)"
                        : "Review Mistakes"
                }
            >
                {isPerfect ? (
                    <span className="flex items-center gap-2">
                        <BookOpen className="h-4 w-4" aria-hidden="true" />
                        Review Mistakes
                    </span>
                ) : (
                    <Link href={`/dashboard/practice/review/${sessionId}`}>
                        <BookOpen className="mr-2 h-4 w-4" aria-hidden="true" />
                        Review Mistakes
                    </Link>
                )}
            </Button>

            {/* View Analytics */}
            <Button asChild variant="ghost" size="lg" className="w-full sm:w-auto">
                <Link href="/dashboard/analytics">
                    <BarChart2 className="mr-2 h-4 w-4" aria-hidden="true" />
                    View Analytics
                </Link>
            </Button>
        </div>
    )
}
