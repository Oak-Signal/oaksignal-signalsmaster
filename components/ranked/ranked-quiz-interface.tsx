"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  Maximize,
  Minimize,
  Settings,
  Loader2,
  Volume2,
  VolumeX,
  X,
  Zap,
  ZapOff,
} from "lucide-react";

import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { QuizContainer } from "@/components/practice/quiz-container";
import { FlagDisplay } from "@/components/practice/flag-display";
import { ExamProgressHeader } from "@/components/exam/exam-progress-header";
import { RankedOptionGrid } from "@/components/ranked/ranked-option-grid";
import { useToast } from "@/hooks/use-toast";

interface RankedQuizInterfaceProps {
  runId: string;
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}

// Global AudioContext cache to avoid re-creation
let audioCtx: AudioContext | null = null;

function playSound(type: "correct" | "incorrect" | "click") {
  if (typeof window === "undefined") return;
  try {
    if (!audioCtx) {
      const AudioCtx = window.AudioContext ?? window.webkitAudioContext;
      if (!AudioCtx) return;
      audioCtx = new AudioCtx();
    }
    if (audioCtx.state === "suspended") {
      audioCtx.resume();
    }

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    const now = audioCtx.currentTime;

    if (type === "click") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(600, now);
      gain.gain.setValueAtTime(0.04, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
      osc.start(now);
      osc.stop(now + 0.04);
    } else if (type === "correct") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.setValueAtTime(659.25, now + 0.06); // E5
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.2);
    } else if (type === "incorrect") {
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.setValueAtTime(110, now + 0.06);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.start(now);
      osc.stop(now + 0.25);
    }
  } catch (e) {
    console.warn("Sound synthesis blocked or not supported", e);
  }
}

function triggerHaptic(type: "correct" | "incorrect" | "click") {
  if (typeof window !== "undefined" && navigator.vibrate) {
    if (type === "correct") {
      navigator.vibrate(12);
    } else if (type === "incorrect") {
      navigator.vibrate([80, 40, 80]);
    } else {
      navigator.vibrate(5);
    }
  }
}

export function RankedQuizInterface({ runId }: RankedQuizInterfaceProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [, startTransition] = useTransition();

  // Queries & Mutations
  const runState = useQuery(api.ranked.getRankedRunState, {
    runId: runId as Id<"rankedRuns">,
  });
  const questions = useQuery(api.ranked.getRankedRunQuestions, {
    runId: runId as Id<"rankedRuns">,
  });

  const submitAnswerMutation = useMutation(api.ranked.submitRankedAnswer);
  const completeRunMutation = useMutation(api.ranked.completeRankedRun);
  const abandonRunMutation = useMutation(api.ranked.abandonRankedRun);

  const [focusMode, setFocusMode] = useState<boolean>(
    () => typeof window !== "undefined" && localStorage.getItem("ranked_focus_mode") === "true"
  );
  const [performanceMode, setPerformanceMode] = useState<boolean>(
    () => typeof window !== "undefined" && localStorage.getItem("ranked_perf_mode") === "true"
  );
  const [soundEnabled, setSoundEnabled] = useState<boolean>(
    () => typeof window !== "undefined" ? localStorage.getItem("ranked_sound_enabled") !== "false" : true
  );
  const [hapticEnabled, setHapticEnabled] = useState<boolean>(
    () => typeof window !== "undefined" ? localStorage.getItem("ranked_haptic_enabled") !== "false" : true
  );
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Quiz Navigation State
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [localStreak, setLocalStreak] = useState(0);

  // Time metrics
  const [totalElapsed, setTotalElapsed] = useState(0);
  const [questionTime, setQuestionTime] = useState(0);
  const questionLoadedAtRef = useRef<number>(0);
  const runStartedAtRef = useRef<number>(0);

  // Connection dot state
  const [isOnline, setIsOnline] = useState(true);

  // Background mutation tracker
  const pendingSubmissionsRef = useRef<Set<number>>(new Set());
  const [pendingSubmissionsCount, setPendingSubmissionsCount] = useState(0);
  const failedSubmissionsRef = useRef<Map<number, { selectedAnswer: string }>>(new Map());
  const [failedSubmissionsCount, setFailedSubmissionsCount] = useState(0);
  const [isRetryingFailed, setIsRetryingFailed] = useState(false);
  const [finalizingRun, setFinalizingRun] = useState(false);

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (typeof document === "undefined") return;
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.warn(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  // Register event listeners only (localStorage now initializes state lazily above)
  useEffect(() => {
    const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handleFsChange);

    const updateOnlineStatus = () => setIsOnline(navigator.onLine);
    window.addEventListener("online", updateOnlineStatus);
    window.addEventListener("offline", updateOnlineStatus);

    return () => {
      document.removeEventListener("fullscreenchange", handleFsChange);
      window.removeEventListener("online", updateOnlineStatus);
      window.removeEventListener("offline", updateOnlineStatus);
    };
  }, []);

  // Save settings helpers
  const updateFocusMode = (val: boolean) => {
    setFocusMode(val);
    localStorage.setItem("ranked_focus_mode", String(val));
  };
  const updatePerformanceMode = (val: boolean) => {
    setPerformanceMode(val);
    localStorage.setItem("ranked_perf_mode", String(val));
  };
  const updateSoundEnabled = (val: boolean) => {
    setSoundEnabled(val);
    localStorage.setItem("ranked_sound_enabled", String(val));
  };
  const updateHapticEnabled = (val: boolean) => {
    setHapticEnabled(val);
    localStorage.setItem("ranked_haptic_enabled", String(val));
  };

  // Warn cadet if attempting to leave active run
  useEffect(() => {
    if (!runState || runState.status !== "started") return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "Ranked runs cannot be paused. Leaving now will forfeit this attempt.";
      return e.returnValue;
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [runState]);

  // Preload all flag images
  useEffect(() => {
    if (!questions) return;
    questions.forEach((q) => {
      if (q.imagePath) {
        const img = new window.Image();
        img.src = q.imagePath;
      }
      q.options.forEach((opt) => {
        if (opt.imagePath) {
          const img = new window.Image();
          img.src = opt.imagePath;
        }
      });
    });

    // Resume from first unanswered question
    const firstUnanswered = questions.findIndex((q) => q.userAnswer === null);
    if (firstUnanswered !== -1) {
      startTransition(() => {
        setCurrentIndex(firstUnanswered);
        setLocalStreak(0);
      });
    } else if (questions.length > 0) {
      startTransition(() => setCurrentIndex(questions.length));
    }
  }, [questions, startTransition]);

  // Run timer updates
  useEffect(() => {
    if (!runState || runState.status !== "started") return;

    runStartedAtRef.current = runState.startedAt || Date.now();
    questionLoadedAtRef.current = Date.now();

    const timerInterval = setInterval(() => {
      const now = Date.now();
      setTotalElapsed(Math.max(0, Math.floor((now - runStartedAtRef.current) / 1000)));
      setQuestionTime(now - questionLoadedAtRef.current);
    }, 50);

    return () => clearInterval(timerInterval);
  }, [runState]);

  // Handle question loaded timer resets
  useEffect(() => {
    questionLoadedAtRef.current = Date.now();
    startTransition(() => setQuestionTime(0));
  }, [currentIndex, startTransition]);

  const retryFailedSubmissions = useCallback(async () => {
    if (isRetryingFailed) return;
    const failedEntries = Array.from(failedSubmissionsRef.current.entries());
    if (failedEntries.length === 0) return;

    setIsRetryingFailed(true);

    try {
      await Promise.all(
        failedEntries.map(async ([questionIndex, payload]) => {
          try {
            await submitAnswerMutation({
              runId: runId as Id<"rankedRuns">,
              questionIndex,
              selectedAnswer: payload.selectedAnswer,
            });
            failedSubmissionsRef.current.delete(questionIndex);
          } catch (err) {
            const message = err instanceof Error ? err.message : "Unknown submission error";
            if (message.includes("already been answered")) {
              failedSubmissionsRef.current.delete(questionIndex);
              return;
            }
            throw err;
          }
        })
      );

      setFailedSubmissionsCount(failedSubmissionsRef.current.size);

      toast({
        title: "Answer Sync Restored",
        description: "All queued answer submissions were synchronized.",
      });
    } catch (err) {
      toast({
        title: "Sync Retry Failed",
        description: err instanceof Error ? err.message : "Some answers could not be synchronized yet.",
        variant: "destructive",
      });
    } finally {
      setIsRetryingFailed(false);
    }
  }, [isRetryingFailed, runId, submitAnswerMutation, toast]);

  const handleFinalizeRun = useCallback(async () => {
    setFinalizingRun(true);
    try {
      const result = await completeRunMutation({ runId: runId as Id<"rankedRuns"> });
      toast({
        title: "Ranked Run Complete",
        description: `Your run was completed with a score of ${result.score}. Signed result ${result.signatureVersion} issued.`,
      });
      startTransition(() => {
        router.replace(`/dashboard/ranked/run/${runId}/results`);
      });
    } catch (e) {
      toast({
        title: "Error completing run",
        description: e instanceof Error ? e.message : "Submission failed",
        variant: "destructive",
      });
      setFinalizingRun(false);
    }
  }, [completeRunMutation, runId, router, toast]);

  // Final completion watchdog
  useEffect(() => {
    if (!questions || questions.length === 0) return;
    if (currentIndex >= questions.length && runState?.status === "started" && !finalizingRun) {
      // Check if background mutations are still in-flight
      if (pendingSubmissionsRef.current.size === 0 && failedSubmissionsRef.current.size === 0) {
        startTransition(() => { handleFinalizeRun(); });
      }
    }
  }, [currentIndex, questions, pendingSubmissionsCount, failedSubmissionsCount, runState, finalizingRun, handleFinalizeRun, startTransition]);

  const handleAbandonRun = async () => {
    if (!confirm("Are you sure you want to exit? Your ranked run progress will be lost and count as an attempt.")) {
      return;
    }

    try {
      await abandonRunMutation({ runId: runId as Id<"rankedRuns"> });
      router.replace("/dashboard/ranked");
    } catch (e) {
      toast({
        title: "Error exiting run",
        description: e instanceof Error ? e.message : "Exit failed",
        variant: "destructive",
      });
    }
  };

  const handleOptionSelect = useCallback((optionId: string) => {
    if (selectedAnswer !== null || !questions) return;
    const currentQuestion = questions[currentIndex];
    if (!currentQuestion) return;

    if (soundEnabled) playSound("click");
    if (hapticEnabled) triggerHaptic("click");

    // Local state updates
    setSelectedAnswer(optionId);

    // Submit answer in background
    pendingSubmissionsRef.current.add(currentIndex);
    setPendingSubmissionsCount(pendingSubmissionsRef.current.size);

    submitAnswerMutation({
      runId: runId as Id<"rankedRuns">,
      questionIndex: currentIndex,
      selectedAnswer: optionId,
    })
      .then((result) => {
        if (soundEnabled) {
          playSound(result.isCorrect ? "correct" : "incorrect");
        }
        if (hapticEnabled) {
          triggerHaptic(result.isCorrect ? "correct" : "incorrect");
        }
        setLocalStreak((prev) => (result.isCorrect ? prev + 1 : 0));

        failedSubmissionsRef.current.delete(currentIndex);
        setFailedSubmissionsCount(failedSubmissionsRef.current.size);

        pendingSubmissionsRef.current.delete(currentIndex);
        setPendingSubmissionsCount(pendingSubmissionsRef.current.size);
      })
      .catch((err) => {
        console.error(`Submission failed for index ${currentIndex}:`, err);

        const message = err instanceof Error ? err.message : "Unknown submission error";
        if (message.includes("already been answered")) {
          failedSubmissionsRef.current.delete(currentIndex);
          setFailedSubmissionsCount(failedSubmissionsRef.current.size);
        } else {
          failedSubmissionsRef.current.set(currentIndex, {
            selectedAnswer: optionId,
          });
          setFailedSubmissionsCount(failedSubmissionsRef.current.size);
        }

        pendingSubmissionsRef.current.delete(currentIndex);
        setPendingSubmissionsCount(pendingSubmissionsRef.current.size);
        toast({
          title: "Submission Lag Detected",
          description: "Answer queued for sync. Retry will run before finalization.",
          variant: "destructive",
        });
      });

    // Lightning fast transition
    const transitionDelay = 80;
    setTimeout(() => {
      setSelectedAnswer(null);
      setCurrentIndex((prev) => prev + 1);
    }, transitionDelay);
  }, [selectedAnswer, questions, currentIndex, soundEnabled, hapticEnabled, submitAnswerMutation, runId, toast]);

  // Keyboard events listener
  useEffect(() => {
    if (!questions || currentIndex >= questions.length || selectedAnswer !== null) return;
    const currentQuestion = questions[currentIndex];
    if (!currentQuestion) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      let optionIndex = -1;
      const key = e.key;
      if (key === "1" || key === "a" || key === "A") optionIndex = 0;
      else if (key === "2" || key === "b" || key === "B") optionIndex = 1;
      else if (key === "3" || key === "c" || key === "C") optionIndex = 2;
      else if (key === "4" || key === "d" || key === "D") optionIndex = 3;

      if (optionIndex !== -1 && currentQuestion.options[optionIndex]) {
        if (soundEnabled) playSound("click");
        handleOptionSelect(currentQuestion.options[optionIndex].id);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentIndex, questions, selectedAnswer, soundEnabled, hapticEnabled, handleOptionSelect]);

  // Loading indicator for query loads
  if (runState === undefined || questions === undefined) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="mt-4 text-sm text-muted-foreground">Initializing ranked run environment...</p>
      </div>
    );
  }

  if (!runState || !questions) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6 text-center text-foreground">
        <h2 className="text-2xl font-bold">Run Not Found</h2>
        <p className="mt-2 text-muted-foreground">The ranked run could not be found or you do not have permission.</p>
        <Button onClick={() => router.replace("/dashboard/ranked")} className="mt-4">
          Back to Entry Dashboard
        </Button>
      </div>
    );
  }

  // Redirect if session is already concluded
  if (!runState || runState.status === "completed" || runState.status === "abandoned" || runState.status === "flagged") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6 text-center text-foreground">
        <h2 className="text-2xl font-bold">Session Closed</h2>
        <p className="mt-2 text-muted-foreground">This ranked run has already been completed or abandoned.</p>
        <Button onClick={() => router.replace("/dashboard/ranked")} className="mt-4">
          Back to Entry Dashboard
        </Button>
      </div>
    );
  }

  const currentQuestion = questions[currentIndex];
  const totalQuestions = questions.length;

  // Render finalized loaders
  const isFinalizing = finalizingRun || currentIndex >= totalQuestions;

  // Additive ranked per-question color-coded timer (retained on top of shared UI)
  const timerColorClass = () => {
    if (questionTime < 1500) return "text-emerald-500 border-emerald-500/40 bg-emerald-500/10";
    if (questionTime < 3000) return "text-amber-500 border-amber-500/40 bg-amber-500/10";
    return "text-rose-500 border-rose-500/40 bg-rose-500/10";
  };

  const formatTotalTime = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const answeredCount = Math.min(currentIndex, totalQuestions);
  const remainingCount = Math.max(0, totalQuestions - answeredCount);
  const completionPercent = totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0;
  const currentQuestionNumber = Math.min(currentIndex + 1, totalQuestions);

  return (
    <div className="flex min-h-screen select-none flex-col bg-background text-foreground">
      {/* Top Header bar */}
      <header className="mx-auto flex h-12 w-full max-w-5xl items-center justify-between gap-4 px-4 md:px-6">
        <div className="flex items-center gap-2">
          <Button
            onClick={() => void handleAbandonRun()}
            variant="ghost"
            size="sm"
            className="gap-1.5"
          >
            <ArrowLeft className="h-4 w-4" />
            Exit
          </Button>

          {/* Connection Dot */}
          <div className="ml-2 flex items-center gap-1.5" aria-live="polite">
            <span
              aria-hidden="true"
              className={`h-2.5 w-2.5 rounded-full ${
                isOnline ? "bg-emerald-500 animate-pulse" : "bg-rose-500 animate-ping"
              }`}
            />
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {isOnline ? "Online" : "Offline"}
            </span>
          </div>
        </div>

        {/* Dynamic Combo badge */}
        {localStreak >= 3 && (
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: [1, 1.25, 1], opacity: 1 }}
            key={localStreak}
            className="flex items-center gap-1 rounded-full bg-linear-to-r from-amber-500 to-orange-500 px-2.5 py-1 text-xs font-extrabold uppercase text-slate-950 shadow"
          >
            🔥 Combo {localStreak}x
          </motion.div>
        )}

        {/* System Settings & Fullscreen toggles */}
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setSettingsOpen(!settingsOpen)}
            title="Quiz settings"
            aria-label="Open quiz settings"
          >
            <Settings className="h-4 w-4" />
          </Button>

          <Button
            size="icon"
            variant="ghost"
            onClick={toggleFullscreen}
            className="hidden sm:inline-flex"
            title="Toggle Fullscreen"
            aria-label="Toggle fullscreen"
          >
            {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </Button>
        </div>
      </header>

      {/* Main workspace */}
      <main className="relative flex-1">
        {/* Settings Dialog Overlay */}
        {settingsOpen && (
          <div
            className="absolute inset-0 z-50 flex items-center justify-center bg-background/90 p-4 backdrop-blur-md"
            role="dialog"
            aria-modal="true"
            aria-label="Runner settings"
          >
            <Card className="w-full max-w-sm">
              <CardContent className="space-y-5 p-6">
                <div className="flex items-center justify-between border-b pb-3">
                  <h3 className="text-lg font-bold">Runner Settings</h3>
                  <Button size="icon" variant="ghost" onClick={() => setSettingsOpen(false)} className="h-8 w-8" aria-label="Close settings">
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <div className="space-y-4 text-sm">
                  {/* Focus Mode */}
                  <label htmlFor="ranked-focus-mode" className="flex cursor-pointer items-center justify-between gap-4">
                    <div className="flex flex-col">
                      <span className="flex items-center gap-1.5 font-semibold">
                        {focusMode ? <EyeOff className="h-4 w-4 text-amber-500" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                        Focus Mode
                      </span>
                      <span className="mt-0.5 text-xs text-muted-foreground">Hides timers to reduce testing pressure.</span>
                    </div>
                    <input
                      id="ranked-focus-mode"
                      type="checkbox"
                      checked={focusMode}
                      onChange={(e) => updateFocusMode(e.target.checked)}
                      className="h-4.5 w-4.5 rounded accent-primary"
                    />
                  </label>

                  {/* Performance Mode */}
                  <label htmlFor="ranked-perf-mode" className="flex cursor-pointer items-center justify-between gap-4">
                    <div className="flex flex-col">
                      <span className="flex items-center gap-1.5 font-semibold">
                        {performanceMode ? <ZapOff className="h-4 w-4 text-amber-500" /> : <Zap className="h-4 w-4 text-muted-foreground" />}
                        Performance Mode
                      </span>
                      <span className="mt-0.5 text-xs text-muted-foreground">Removes animations for a smoother display.</span>
                    </div>
                    <input
                      id="ranked-perf-mode"
                      type="checkbox"
                      checked={performanceMode}
                      onChange={(e) => updatePerformanceMode(e.target.checked)}
                      className="h-4.5 w-4.5 rounded accent-primary"
                    />
                  </label>

                  {/* Sound FX */}
                  <label htmlFor="ranked-sound" className="flex cursor-pointer items-center justify-between gap-4">
                    <div className="flex flex-col">
                      <span className="flex items-center gap-1.5 font-semibold">
                        {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4 text-muted-foreground" />}
                        Synthesizer Audio
                      </span>
                      <span className="mt-0.5 text-xs text-muted-foreground">Plays audio pitch feedback on select.</span>
                    </div>
                    <input
                      id="ranked-sound"
                      type="checkbox"
                      checked={soundEnabled}
                      onChange={(e) => updateSoundEnabled(e.target.checked)}
                      className="h-4.5 w-4.5 rounded accent-primary"
                    />
                  </label>

                  {/* Vibrate Haptic */}
                  <label htmlFor="ranked-haptic" className="flex cursor-pointer items-center justify-between gap-4">
                    <div className="flex flex-col">
                      <span className="font-semibold">Haptic Vibration</span>
                      <span className="mt-0.5 text-xs text-muted-foreground">Triggers touch confirmation on mobile.</span>
                    </div>
                    <input
                      id="ranked-haptic"
                      type="checkbox"
                      checked={hapticEnabled}
                      onChange={(e) => updateHapticEnabled(e.target.checked)}
                      className="h-4.5 w-4.5 rounded accent-primary"
                    />
                  </label>
                </div>

                <Button onClick={() => setSettingsOpen(false)} variant="secondary" className="mt-2 w-full">
                  Confirm Settings
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {isFinalizing ? (
          <QuizContainer className="flex min-h-[60vh] flex-col items-center justify-center text-center">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <h3 className="mt-4 text-xl font-bold">Finalizing Ranked Run...</h3>
            <p className="mt-2 max-w-xs text-sm text-muted-foreground">
              Saving answers and checking integrity values. Please keep the page open.
            </p>
          </QuizContainer>
        ) : (
          <QuizContainer>
            {/* Progress header (parity with exam mode) */}
            <ExamProgressHeader
              currentQuestionNumber={currentQuestionNumber}
              answeredCount={answeredCount}
              remainingCount={remainingCount}
              totalQuestions={totalQuestions}
              completionPercent={completionPercent}
              elapsedMs={totalElapsed * 1000}
            />

            {/* Additive ranked per-question timer (hidden in Focus Mode) */}
            {!focusMode && (
              <div className="flex items-center justify-center gap-3" aria-hidden="true">
                <div
                  className={`flex items-center justify-center rounded-full border px-3 py-1.5 font-mono text-xs font-bold tracking-wider transition-colors duration-300 ${timerColorClass()}`}
                >
                  Q: {(questionTime / 1000).toFixed(1)}s
                </div>
                <div className="rounded-full border bg-muted px-3 py-1.5 font-mono text-xs font-bold text-muted-foreground">
                  ⏱️ {formatTotalTime(totalElapsed)}
                </div>
              </div>
            )}

            {/* Question + options */}
            <AnimatePresence mode="wait">
              {currentQuestion && (
                <motion.div
                  key={currentIndex}
                  initial={performanceMode ? {} : { x: 200, opacity: 0 }}
                  animate={performanceMode ? {} : { x: 0, opacity: 1 }}
                  exit={performanceMode ? {} : { x: -200, opacity: 0 }}
                  transition={{ duration: 0.12, ease: "easeInOut" }}
                  className="flex w-full flex-col gap-6"
                >
                  <FlagDisplay
                    mode={currentQuestion.mode}
                    flagImage={currentQuestion.imagePath || undefined}
                    flagName={currentQuestion.name}
                    flagMeaning={currentQuestion.meaning}
                  />

                  <RankedOptionGrid
                    options={currentQuestion.options}
                    mode={currentQuestion.mode}
                    selectedAnswer={selectedAnswer}
                    onSelect={handleOptionSelect}
                    animate={!performanceMode}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </QuizContainer>
        )}
      </main>

      {/* Footer shortcut helper banner */}
      <footer className="mx-auto mt-6 flex h-12 w-full max-w-5xl items-center justify-between border-t px-4 pt-4 text-xs font-semibold text-muted-foreground md:px-6">
        <span>Keyboard: Press 1-4 for instant answer submit</span>
        <div className="flex items-center gap-3">
          {pendingSubmissionsCount > 0 && (
            <span className="animate-pulse text-amber-500" role="status">
              Syncing answers ({pendingSubmissionsCount} pending)...
            </span>
          )}
          {failedSubmissionsCount > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => void retryFailedSubmissions()}
              disabled={isRetryingFailed}
              className="h-7"
            >
              {isRetryingFailed ? "Retrying..." : `Retry sync (${failedSubmissionsCount})`}
            </Button>
          )}
        </div>
      </footer>
    </div>
  );
}
