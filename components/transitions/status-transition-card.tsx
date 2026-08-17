"use client";

import type { ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface StatusTransitionCardProps {
  title: string;
  primaryLine: string;
  secondaryLine: string;
  liveMessage: string;
  progressValue: number;
  progressAriaLabel: string;
  buttonState: "loading" | "success";
  buttonLoadingLabel: string;
  buttonSuccessLabel: string;
  onContinue: () => void;
  centerLoadingIcon: ReactNode;
  centerSuccessIcon: ReactNode;
  buttonLoadingIcon: ReactNode;
  buttonSuccessIcon: ReactNode;
  iconToneClassName: string;
  glowPrimaryClassName: string;
  glowSecondaryClassName: string;
}

/**
 * Shared auth transition card used by sign-in success and sign-out success flows.
 * Keeps layout/motion/interaction behavior consistent while allowing content/icon tones to differ.
 */
export function StatusTransitionCard({
  title,
  primaryLine,
  secondaryLine,
  liveMessage,
  progressValue,
  progressAriaLabel,
  buttonState,
  buttonLoadingLabel,
  buttonSuccessLabel,
  onContinue,
  centerLoadingIcon,
  centerSuccessIcon,
  buttonLoadingIcon,
  buttonSuccessIcon,
  iconToneClassName,
  glowPrimaryClassName,
  glowSecondaryClassName,
}: StatusTransitionCardProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <main className="relative flex min-h-[calc(100vh-4rem)] items-center justify-center overflow-hidden px-4 py-10">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className={`absolute -top-12 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full blur-3xl ${glowPrimaryClassName}`} />
        <div className={`absolute right-0 top-1/3 h-52 w-52 rounded-full blur-3xl ${glowSecondaryClassName}`} />
      </div>

      <motion.div
        initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
        animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
        transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.22, ease: "easeOut" }}
        className="w-full max-w-md"
      >
        <Card className="w-full overflow-hidden border-border/70 bg-background/95 shadow-lg backdrop-blur-sm">
          <Progress value={progressValue} className="h-1 rounded-none" aria-label={progressAriaLabel} />

          <CardHeader className="space-y-3 pt-6 text-center">
            <motion.div
              className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full ${iconToneClassName}`}
              initial={shouldReduceMotion ? false : { scale: 0.9, opacity: 0.7 }}
              animate={shouldReduceMotion ? { scale: 1, opacity: 1 } : { scale: [1, 1.04, 1], opacity: [1, 0.92, 1] }}
              transition={
                shouldReduceMotion
                  ? { duration: 0 }
                  : {
                      duration: 1.4,
                      repeat: Number.POSITIVE_INFINITY,
                      ease: "easeInOut",
                    }
              }
            >
              <AnimatePresence mode="wait" initial={false}>
                {buttonState === "loading" ? (
                  <motion.span
                    key="center-loading"
                    initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.9 }}
                    animate={shouldReduceMotion ? undefined : { opacity: 1, scale: 1 }}
                    exit={shouldReduceMotion ? undefined : { opacity: 0, scale: 0.9 }}
                    transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.14 }}
                  >
                    {centerLoadingIcon}
                  </motion.span>
                ) : (
                  <motion.span
                    key="center-success"
                    initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.86 }}
                    animate={shouldReduceMotion ? undefined : { opacity: 1, scale: 1 }}
                    exit={shouldReduceMotion ? undefined : { opacity: 0 }}
                    transition={
                      shouldReduceMotion
                        ? { duration: 0 }
                        : { type: "spring", stiffness: 360, damping: 22 }
                    }
                  >
                    {centerSuccessIcon}
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.div>

            <CardTitle className="text-2xl tracking-tight">{title}</CardTitle>
            <CardDescription className="space-y-1 text-sm">
              <p className="font-medium text-foreground">{primaryLine}</p>
              <p className="text-muted-foreground">{secondaryLine}</p>
            </CardDescription>

            <p className="sr-only" aria-live="polite">
              {liveMessage}
            </p>
          </CardHeader>

          <CardContent className="space-y-3 pb-6">
            <motion.div
              whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
              transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.12 }}
            >
              <Button type="button" className="w-full" onClick={onContinue}>
                <AnimatePresence mode="wait" initial={false}>
                  {buttonState === "loading" ? (
                    <motion.span
                      key="button-loading"
                      initial={shouldReduceMotion ? false : { opacity: 0, y: 4 }}
                      animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
                      exit={shouldReduceMotion ? undefined : { opacity: 0, y: -4 }}
                      transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.16 }}
                      className="inline-flex items-center"
                    >
                      {buttonLoadingIcon}
                      {buttonLoadingLabel}
                    </motion.span>
                  ) : (
                    <motion.span
                      key="button-success"
                      initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.92 }}
                      animate={shouldReduceMotion ? undefined : { opacity: 1, scale: 1 }}
                      exit={shouldReduceMotion ? undefined : { opacity: 0 }}
                      transition={
                        shouldReduceMotion
                          ? { duration: 0 }
                          : { type: "spring", stiffness: 360, damping: 22 }
                      }
                      className="inline-flex items-center"
                    >
                      {buttonSuccessIcon}
                      {buttonSuccessLabel}
                    </motion.span>
                  )}
                </AnimatePresence>
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </motion.div>
          </CardContent>
        </Card>
      </motion.div>
    </main>
  );
}
