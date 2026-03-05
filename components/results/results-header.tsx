"use client"

/**
 * ResultsHeader
 * Displays the score hero, session metadata, and contextual message
 * (celebration for 100%, encouragement for lower scores).
 */

import { motion } from "framer-motion"
import { Trophy, Clock, Flag, Hash } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { PerfectScoreCelebration } from "@/components/practice/celebration-animation"
import { cn } from "@/lib/utils"
import type { SessionResult } from "@/lib/results-types"

interface ResultsHeaderProps {
    result: SessionResult
}

/** Format ms duration into a human-readable string like "2m 34s" */
function formatDuration(ms: number | null): string {
    if (!ms) return "—"
    const totalSeconds = Math.floor(ms / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    if (minutes === 0) return `${seconds}s`
    return `${minutes}m ${seconds}s`
}

function getScoreVariant(score: number): {
    label: string
    description: string
    colorClass: string
} {
    if (score === 100)
        return {
            label: "Perfect Score! 🎉",
            description: "You got every single flag right. Outstanding seamanship.",
            colorClass: "text-yellow-500 dark:text-yellow-400",
        }
    if (score >= 80)
        return {
            label: "Great Job!",
            description:
                "Strong performance. Review the missed flags to push toward 100%.",
            colorClass: "text-green-600 dark:text-green-400",
        }
    if (score >= 60)
        return {
            label: "Good Effort",
            description:
                "Solid foundation. Focus on the flags you missed and try again.",
            colorClass: "text-blue-600 dark:text-blue-400",
        }
    return {
        label: "Keep Practicing",
        description:
            "Every expert started somewhere. Review your mistakes and practice again — you'll improve fast.",
        colorClass: "text-muted-foreground",
    }
}

export function ResultsHeader({ result }: ResultsHeaderProps) {
    const { score, correctCount, totalQuestions, mode, timeTaken } = result
    const { label, description, colorClass } = getScoreVariant(score)
    const isPerfect = score === 100

    return (
        <>
            {/* Perfect score celebration (fires confetti on mount) */}
            <PerfectScoreCelebration trigger={isPerfect} />

            <motion.div
                initial={{ opacity: 0, y: -16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className="flex flex-col items-center gap-4 text-center"
            >
                {/* Icon */}
                <div
                    className={cn(
                        "flex h-20 w-20 items-center justify-center rounded-full",
                        isPerfect
                            ? "bg-yellow-100 dark:bg-yellow-900/30"
                            : "bg-primary/10"
                    )}
                    aria-hidden="true"
                >
                    <Trophy
                        className={cn(
                            "h-10 w-10",
                            isPerfect ? "text-yellow-500 dark:text-yellow-400" : "text-primary"
                        )}
                    />
                </div>

                {/* Score hero */}
                <div>
                    <motion.p
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.15, duration: 0.35, ease: "backOut" }}
                        className={cn("text-6xl font-extrabold tabular-nums", colorClass)}
                        aria-label={`Score: ${score} percent`}
                    >
                        {score}%
                    </motion.p>
                    <p className="mt-1 text-lg text-muted-foreground">
                        {correctCount} out of {totalQuestions} correct
                    </p>
                </div>

                {/* Contextual message */}
                <div className="max-w-md">
                    <p className="text-xl font-semibold">{label}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{description}</p>
                </div>

                {/* Session metadata pills */}
                <div
                    className="flex flex-wrap items-center justify-center gap-2"
                    aria-label="Session details"
                >
                    <Badge variant="secondary" className="gap-1.5 px-3 py-1">
                        <Flag className="h-3.5 w-3.5" aria-hidden="true" />
                        <span className="capitalize">{mode} Mode</span>
                    </Badge>
                    <Badge variant="secondary" className="gap-1.5 px-3 py-1">
                        <Hash className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>{totalQuestions} Questions</span>
                    </Badge>
                    {timeTaken !== null && (
                        <Badge variant="secondary" className="gap-1.5 px-3 py-1">
                            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>{formatDuration(timeTaken)}</span>
                        </Badge>
                    )}
                </div>
            </motion.div>
        </>
    )
}
