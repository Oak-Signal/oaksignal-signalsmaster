"use client"

/**
 * Flag Display Component
 * Conditionally displays flag image OR flag meaning based on quiz mode
 * - "learn" mode: Shows flag IMAGE, user selects name from text options
 * - "match" mode: Shows flag MEANING as text, user selects flag from image options
 */

import { motion } from "framer-motion"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import Image from "next/image"
import { QuestionType } from "@/lib/practice-types"

interface FlagDisplayProps {
  mode: QuestionType
  flagImage?: string
  flagName?: string
  flagMeaning?: string
  isLoading?: boolean
  className?: string
}

export function FlagDisplay({
  mode,
  flagImage,
  flagName,
  flagMeaning,
  isLoading = false,
  className,
}: FlagDisplayProps) {
  if (isLoading) {
    return (
      <Card className={cn("overflow-hidden", className)}>
        <CardContent className="flex items-center justify-center p-8 min-h-80">
          <Skeleton className="h-64 w-full max-w-md" />
        </CardContent>
      </Card>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3 }}
      className={className}
    >
      <Card className="overflow-hidden border-2">
        <CardContent className="flex items-center justify-center p-8 min-h-80">
          {mode === "learn" ? (
            // LEARN MODE: Show flag image
            <div className="relative w-full max-w-md aspect-4/3">
              {flagImage ? (
                <Image
                  src={flagImage}
                  alt={flagName ? `Signal flag for ${flagName}` : "Signal flag"}
                  fill
                  className="object-contain drop-shadow-lg"
                  unoptimized
                  priority
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
                  <AlertCircle className="h-12 w-12" />
                  <p className="text-sm">Flag image not available</p>
                </div>
              )}
            </div>
          ) : (
            // MATCH MODE: Show flag meaning as prompt
            <div className="text-center space-y-4 max-w-md">
              <div className="space-y-2">
                <h2 className="text-4xl font-bold tracking-tight">
                  {flagMeaning || "Unknown meaning"}
                </h2>
                <div className="h-1 w-24 mx-auto bg-primary/30 rounded-full" />
              </div>
              <p className="text-lg text-muted-foreground leading-relaxed">
                Which flag represents this meaning?
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}
