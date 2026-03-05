"use client"

/**
 * QuestionReviewList
 * Renders every question from the session as a row showing:
 * - Flag thumbnail
 * - Flag name
 * - Correct / Incorrect badge
 * - For wrong answers: what the user selected vs. the correct answer (collapsible)
 * - Click thumbnail to navigate to the flag reference page
 */

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import { CheckCircle2, XCircle, ChevronDown, ChevronUp, ExternalLink } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { SessionResultQuestion } from "@/lib/results-types"

interface QuestionReviewListProps {
    questions: SessionResultQuestion[]
}

interface QuestionRowProps {
    question: SessionResultQuestion
    number: number
}

function QuestionRow({ question, number }: QuestionRowProps) {
    const [expanded, setExpanded] = useState(false)
    const {
        isCorrect,
        flagName,
        flagKey,
        flagImagePath,
        userAnswerLabel,
        correctAnswerLabel,
    } = question

    return (
        <motion.li
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: number * 0.04 }}
        >
            <Card
                className={cn(
                    "overflow-hidden border transition-colors",
                    isCorrect
                        ? "border-green-200 dark:border-green-900"
                        : "border-red-200 dark:border-red-900"
                )}
            >
                <CardContent className="p-0">
                    {/* Main row */}
                    <div className="flex items-center gap-4 p-4">
                        {/* Question number */}
                        <span
                            className="shrink-0 w-6 text-center text-sm font-medium text-muted-foreground"
                            aria-hidden="true"
                        >
                            {number}
                        </span>

                        {/* Flag thumbnail — links to reference */}
                        <Link
                            href={`/dashboard/reference/flags/${flagKey}`}
                            className="shrink-0 rounded-md overflow-hidden ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            aria-label={`View ${flagName} in reference guide`}
                        >
                            <div className="relative h-12 w-16 bg-muted rounded-md">
                                <Image
                                    src={flagImagePath}
                                    alt={flagName}
                                    fill
                                    className="object-contain p-1"
                                    sizes="64px"
                                />
                            </div>
                        </Link>

                        {/* Flag name + reference link icon */}
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                                <p className="font-medium truncate">{flagName}</p>
                                <Link
                                    href={`/dashboard/reference/flags/${flagKey}`}
                                    className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                                    aria-label={`Open ${flagName} reference page`}
                                    tabIndex={-1}
                                >
                                    <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                                </Link>
                            </div>
                            <p className="text-xs text-muted-foreground capitalize">
                                {question.questionType} mode
                            </p>
                        </div>

                        {/* Correct / Incorrect badge */}
                        {isCorrect ? (
                            <Badge
                                variant="outline"
                                className="shrink-0 gap-1 border-green-500 text-green-600 dark:text-green-400"
                                aria-label="Correct"
                            >
                                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                                Correct
                            </Badge>
                        ) : (
                            <Badge
                                variant="outline"
                                className="shrink-0 gap-1 border-red-500 text-red-600 dark:text-red-400"
                                aria-label="Incorrect"
                            >
                                <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                                Incorrect
                            </Badge>
                        )}

                        {/* Expand toggle — only for wrong answers */}
                        {!isCorrect && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="shrink-0 h-8 w-8"
                                onClick={() => setExpanded((v) => !v)}
                                aria-expanded={expanded}
                                aria-label={
                                    expanded ? "Hide answer details" : "Show answer details"
                                }
                            >
                                {expanded ? (
                                    <ChevronUp className="h-4 w-4" aria-hidden="true" />
                                ) : (
                                    <ChevronDown className="h-4 w-4" aria-hidden="true" />
                                )}
                            </Button>
                        )}
                    </div>

                    {/* Expandable answer detail — incorrect answers only */}
                    <AnimatePresence initial={false}>
                        {!isCorrect && expanded && (
                            <motion.div
                                key="detail"
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2, ease: "easeInOut" }}
                                className="overflow-hidden"
                            >
                                <div className="border-t bg-muted/30 px-4 py-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                                    <div>
                                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">
                                            Your answer
                                        </p>
                                        <p className="font-medium text-red-600 dark:text-red-400">
                                            {userAnswerLabel ?? "—"}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">
                                            Correct answer
                                        </p>
                                        <p className="font-medium text-green-600 dark:text-green-400">
                                            {correctAnswerLabel}
                                        </p>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </CardContent>
            </Card>
        </motion.li>
    )
}

export function QuestionReviewList({ questions }: QuestionReviewListProps) {
    const incorrectCount = questions.filter((q) => !q.isCorrect).length

    return (
        <section aria-label="Question review">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Question Breakdown</h2>
                {incorrectCount > 0 && (
                    <p className="text-sm text-muted-foreground">
                        {incorrectCount} missed — click{" "}
                        <ChevronDown className="inline h-3.5 w-3.5" aria-hidden="true" />{" "}
                        to see details
                    </p>
                )}
            </div>

            <ol className="flex flex-col gap-3" aria-label="Questions list">
                {questions.map((q, i) => (
                    <QuestionRow key={q.flagId + i} question={q} number={i + 1} />
                ))}
            </ol>
        </section>
    )
}
