"use client";

/**
 * Ranked Option Grid
 *
 * Mirrors the practice `MultipleChoiceOptions` / exam `ExamOptionGrid` visual + accessibility
 * pattern (Card-based radiogroup, aria-checked, staggered entrance, ≥48px targets) so the ranked
 * quiz matches the established modes.
 *
 * Ranked-specific differences (kept intentionally):
 * - No correct/incorrect reveal — competitive silent submit (like exam mode).
 * - Numbered 1–4 keycap affordance (ranked uses number keys, not A–D letters).
 */

import { motion } from "framer-motion";
import { Check } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import Image from "next/image";

export interface RankedOption {
  id: string;
  label: string;
  imagePath?: string | null;
}

interface RankedOptionGridProps {
  options: RankedOption[];
  mode: "learn" | "match";
  selectedAnswer: string | null;
  disabled?: boolean;
  onSelect: (optionId: string) => void;
  animate?: boolean;
  className?: string;
}

export function RankedOptionGrid({
  options,
  mode,
  selectedAnswer,
  disabled = false,
  onSelect,
  animate = true,
  className,
}: RankedOptionGridProps) {
  return (
    <div
      className={cn("grid grid-cols-1 gap-3 md:grid-cols-2", className)}
      role="radiogroup"
      aria-label="Ranked answer options"
    >
      {options.map((option, index) => {
        const isSelected = option.id === selectedAnswer;
        const isDisabled = disabled || selectedAnswer !== null;
        const optionLabel =
          mode === "learn" && option.label
            ? `Option ${index + 1}: ${option.label}`
            : `Option ${index + 1}`;

        return (
          <motion.div
            key={option.id}
            initial={animate ? { opacity: 0, y: 20 } : false}
            animate={animate ? { opacity: 1, y: 0 } : undefined}
            transition={{ duration: 0.3, delay: index * 0.05 }}
          >
            <Card
              role="radio"
              aria-checked={isSelected}
              aria-label={optionLabel}
              tabIndex={isDisabled ? -1 : 0}
              onClick={() => !isDisabled && onSelect(option.id)}
              onKeyDown={(e) => {
                if (!isDisabled && (e.key === "Enter" || e.key === " ")) {
                  e.preventDefault();
                  onSelect(option.id);
                }
              }}
              className={cn(
                "cursor-pointer transition-all duration-200",
                "hover:scale-[1.02] hover:shadow-md active:scale-[0.98]",
                "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                mode === "match" ? "min-h-32" : "min-h-18",
                isSelected && "border-2 border-primary bg-primary/5 shadow-md",
                isDisabled && !isSelected && "opacity-50",
                isDisabled && "cursor-not-allowed"
              )}
            >
              <CardContent className="flex w-full flex-1 items-center gap-3 p-4">
                {/* Numbered keycap (keyboard shortcut affordance) */}
                <span
                  aria-hidden="true"
                  className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border text-xs font-semibold text-muted-foreground"
                >
                  {index + 1}
                </span>

                {mode === "match" ? (
                  <div className="flex min-h-32 flex-1 items-center justify-center">
                    {option.imagePath ? (
                      <div className="relative h-28 w-full sm:h-32">
                        <Image
                          src={option.imagePath}
                          alt={optionLabel}
                          fill
                          className="object-contain"
                          unoptimized
                          draggable={false}
                        />
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">Image not available</span>
                    )}
                  </div>
                ) : (
                  <span className="flex-1 wrap-break-word text-left text-sm font-semibold leading-tight sm:text-base">
                    {option.label}
                  </span>
                )}

                {isSelected && (
                  <Check className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                )}
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
}
