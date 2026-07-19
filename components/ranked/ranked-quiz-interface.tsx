"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import NextImage from "next/image";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Check,
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
  const failedSubmissionsRef = useRef<Map<number, { selectedAnswer: string; responseTimeMs: number }>>(new Map());
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
              responseTimeMs: payload.responseTimeMs,
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
        description: `Your run was completed with a score of ${result.score}.`,
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

    const responseTimeMs = Date.now() - questionLoadedAtRef.current;

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
      responseTimeMs,
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
            responseTimeMs,
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
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#030712] text-slate-100">
        <Loader2 className="h-10 w-10 animate-spin text-emerald-500" />
        <p className="text-sm text-slate-400 mt-4">Initializing ranked run environment...</p>
      </div>
    );
  }

  if (!runState || !questions) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#030712] text-slate-100 p-6 text-center">
        <h2 className="text-2xl font-bold">Run Not Found</h2>
        <p className="text-slate-400 mt-2">The ranked run could not be found or you do not have permission.</p>
        <Button onClick={() => router.replace("/dashboard/ranked")} className="mt-4 bg-emerald-600 hover:bg-emerald-500">
          Back to Entry Dashboard
        </Button>
      </div>
    );
  }

  // Redirect if session is already concluded
  if (!runState || runState.status === "completed" || runState.status === "abandoned" || runState.status === "flagged") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#030712] text-slate-100 p-6 text-center">
        <h2 className="text-2xl font-bold">Session Closed</h2>
        <p className="text-slate-400 mt-2">This ranked run has already been completed or abandoned.</p>
        <Button onClick={() => router.replace("/dashboard/ranked")} className="mt-4 bg-emerald-600 hover:bg-emerald-500">
          Back to Entry Dashboard
        </Button>
      </div>
    );
  }

  const currentQuestion = questions[currentIndex];
  const totalQuestions = questions.length;

  // Render finalized loaders
  const isFinalizing = finalizingRun || currentIndex >= totalQuestions;

  const timerColorClass = () => {
    if (questionTime < 1500) return "text-emerald-400 border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.25)] bg-emerald-500/5";
    if (questionTime < 3000) return "text-amber-400 border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.25)] bg-amber-500/5";
    return "text-rose-400 border-rose-500/40 shadow-[0_0_15px_rgba(244,63,94,0.25)] bg-rose-500/5";
  };

  const formatTotalTime = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex flex-col justify-between min-h-screen bg-[#030712] text-slate-100 p-4 md:p-6 select-none font-sans overflow-hidden">
      {/* Top Header bar */}
      <header className="flex items-center justify-between gap-4 w-full max-w-5xl mx-auto h-12">
        <div className="flex items-center gap-2">
          <Button
            onClick={() => void handleAbandonRun()}
            variant="ghost"
            className="text-slate-400 hover:text-slate-200 gap-1.5 hover:bg-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Exit
          </Button>

          {/* Connection Dot */}
          <div className="flex items-center gap-1.5 ml-2">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                isOnline
                  ? "bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                  : "bg-rose-500 animate-ping"
              }`}
            />
            <span className="text-[10px] uppercase tracking-wider text-slate-500">
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
            className="bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-extrabold text-xs px-2.5 py-1 rounded-full shadow-[0_0_12px_rgba(245,158,11,0.4)] flex items-center gap-1 uppercase"
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
            className="text-slate-400 hover:text-slate-200 hover:bg-slate-900"
            title="Quiz settings"
          >
            <Settings className="h-4 w-4" />
          </Button>

          <Button
            size="icon"
            variant="ghost"
            onClick={toggleFullscreen}
            className="text-slate-400 hover:text-slate-200 hover:bg-slate-900 hidden sm:inline-flex"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </Button>
        </div>
      </header>

      {/* Main workspace */}
      <main className="flex-1 flex flex-col justify-center items-center w-full max-w-5xl mx-auto py-6">
        {/* Settings Dialog Overlay */}
        {settingsOpen && (
          <div className="absolute inset-0 bg-[#030712]/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <Card className="w-full max-w-sm bg-slate-900 border-slate-800 text-slate-100 shadow-[0_0_40px_rgba(0,0,0,0.5)]">
              <CardContent className="p-6 space-y-5">
                <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                  <h3 className="text-lg font-bold text-slate-200">Runner Settings</h3>
                  <Button size="icon" variant="ghost" onClick={() => setSettingsOpen(false)} className="h-8 w-8 text-slate-400">
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <div className="space-y-4 text-sm">
                  {/* Focus Mode */}
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                        {focusMode ? <EyeOff className="h-4 w-4 text-amber-400" /> : <Eye className="h-4 w-4 text-slate-400" />}
                        Focus Mode
                      </span>
                      <span className="text-xs text-slate-500 mt-0.5">Hides timers to reduce testing pressure.</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={focusMode}
                      onChange={(e) => updateFocusMode(e.target.checked)}
                      className="rounded bg-slate-800 border-slate-700 accent-emerald-500 h-4.5 w-4.5"
                    />
                  </div>

                  {/* Performance Mode */}
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                        {performanceMode ? <ZapOff className="h-4 w-4 text-amber-400" /> : <Zap className="h-4 w-4 text-slate-400" />}
                        Performance Mode
                      </span>
                      <span className="text-xs text-slate-500 mt-0.5">Removes animations for 120fps display.</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={performanceMode}
                      onChange={(e) => updatePerformanceMode(e.target.checked)}
                      className="rounded bg-slate-800 border-slate-700 accent-emerald-500 h-4.5 w-4.5"
                    />
                  </div>

                  {/* Sound FX */}
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                        {soundEnabled ? <Volume2 className="h-4 w-4 text-slate-200" /> : <VolumeX className="h-4 w-4 text-slate-500" />}
                        Synthesizer Audio
                      </span>
                      <span className="text-xs text-slate-500 mt-0.5">Plays audio pitch feedback on select.</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={soundEnabled}
                      onChange={(e) => updateSoundEnabled(e.target.checked)}
                      className="rounded bg-slate-800 border-slate-700 accent-emerald-500 h-4.5 w-4.5"
                    />
                  </div>

                  {/* Vibrate Haptic */}
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="font-semibold text-slate-200">Haptic Vibration</span>
                      <span className="text-xs text-slate-500 mt-0.5">Triggers touch confirmation on mobile.</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={hapticEnabled}
                      onChange={(e) => updateHapticEnabled(e.target.checked)}
                      className="rounded bg-slate-800 border-slate-700 accent-emerald-500 h-4.5 w-4.5"
                    />
                  </div>
                </div>

                <Button onClick={() => setSettingsOpen(false)} className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 mt-2">
                  Confirm Settings
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {isFinalizing ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Loader2 className="h-10 w-10 animate-spin text-emerald-500" />
            <h3 className="text-xl font-bold mt-4">Finalizing Ranked Run...</h3>
            <p className="text-sm text-slate-400 mt-2 max-w-xs">
              Saving answers and checking integrity values. Please keep the page open.
            </p>
          </div>
        ) : (
          <div className="w-full flex flex-col items-center gap-6">
            {/* Top Indicators: Progress & Counters */}
            <div className="flex justify-between items-center w-full max-w-3xl gap-4">
              {/* Question Index */}
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Progress</span>
                <span className="text-lg font-bold tracking-tight text-slate-300">
                  {currentIndex + 1} / {totalQuestions}
                </span>
              </div>

              {/* Real-time Color Coded Timer (unless Focus Mode active) */}
              {!focusMode ? (
                <div className="flex items-center gap-3">
                  {/* Current question timer badge */}
                  <div
                    className={`flex items-center justify-center border px-3 py-1.5 rounded-full text-xs font-mono font-bold tracking-wider transition-all duration-300 ${timerColorClass()}`}
                  >
                    Q: {(questionTime / 1000).toFixed(1)}s
                  </div>
                  {/* Total run duration badge */}
                  <div className="bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-full text-xs font-mono font-bold text-slate-400">
                    ⏱️ {formatTotalTime(totalElapsed)}
                  </div>
                </div>
              ) : (
                <div className="text-xs text-slate-600 font-semibold italic flex items-center">
                  Focus Mode Enabled
                </div>
              )}
            </div>

            {/* Flat Progress Bar (No percentage) */}
            <div className="w-full max-w-3xl bg-slate-900 h-1.5 rounded-full overflow-hidden border border-slate-800/40">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-100 ease-out"
                style={{ width: `${((currentIndex + 1) / totalQuestions) * 100}%` }}
              />
            </div>

            {/* Quiz Container with AnimatePresence */}
            <div className="relative w-full max-w-3xl min-h-[360px] flex items-center justify-center mt-4">
              <AnimatePresence mode="wait">
                {currentQuestion && (
                  <motion.div
                    key={currentIndex}
                    initial={performanceMode ? {} : { x: 300, opacity: 0 }}
                    animate={performanceMode ? {} : { x: 0, opacity: 1 }}
                    exit={performanceMode ? {} : { x: -300, opacity: 0 }}
                    transition={{ duration: 0.08, ease: "easeInOut" }}
                    className="w-full flex flex-col items-center gap-6"
                  >
                    {/* Prompt Header */}
                    {currentQuestion.mode === "match" ? (
                      <div className="text-center py-6">
                        <h2 className="text-xs font-extrabold uppercase tracking-widest text-slate-500">
                          Select the matching Flag/Pennant
                        </h2>
                        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-2 text-slate-100 max-w-xl mx-auto">
                          {currentQuestion.meaning}
                          <span className="block text-sm font-semibold text-emerald-400 uppercase tracking-wider mt-1.5">
                            ({currentQuestion.name})
                          </span>
                        </h1>
                      </div>
                    ) : (
                      /* Flag Display in Learn Mode */
                      <div className="flex flex-col items-center gap-4">
                        <div className="bg-[#111827] border border-slate-800 rounded-xl p-4 shadow-[0_4px_30px_rgba(0,0,0,0.4)] relative flex items-center justify-center w-[260px] h-[180px] sm:w-[320px] sm:h-[220px]">
                          {currentQuestion.imagePath ? (
                            <NextImage
                              src={currentQuestion.imagePath}
                              alt="Signal Flag Prompt"
                              fill
                              className="object-contain filter drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]"
                              draggable={false}
                            />
                          ) : (
                            <span className="text-xs text-slate-500">Flag Image Missing</span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Shuffled multiple choice option block */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full mt-4">
                      {currentQuestion.options.map((option, index) => {
                        const isSelected = selectedAnswer === option.id;

                        let optionStyle = "border-slate-800 bg-slate-900/40 hover:bg-slate-900 hover:border-slate-700 text-slate-200";
                        if (selectedAnswer !== null) {
                          if (isSelected) {
                            optionStyle = "bg-emerald-500/20 border-emerald-500/60 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.3)]";
                          } else {
                            optionStyle = "opacity-40 border-slate-900 bg-slate-950/20 text-slate-500";
                          }
                        }

                        return (
                          <button
                            key={option.id}
                            disabled={selectedAnswer !== null}
                            onClick={() => handleOptionSelect(option.id)}
                            className={`flex items-center justify-between rounded-xl border px-5 py-5 text-left transition-all duration-75 relative cursor-pointer outline-none select-none group min-h-[76px] ${optionStyle}`}
                          >
                            <div className="flex items-center gap-3 w-full">
                              {/* Display Keyboard shortcut Keycap indicator */}
                              <span className="bg-slate-950 text-slate-500 text-[10px] font-mono font-bold h-5 w-5 rounded border border-slate-800 flex items-center justify-center flex-shrink-0 group-hover:border-slate-600 transition-colors">
                                {index + 1}
                              </span>

                              {/* Text option or Image option */}
                              {currentQuestion.mode === "match" ? (
                                <div className="flex items-center justify-center w-24 h-12 bg-[#111827] rounded border border-slate-800/80 p-1">
                                  {option.imagePath ? (
                                    <NextImage
                                      src={option.imagePath}
                                      alt="Match Choice"
                                      fill
                                      className="object-contain"
                                      draggable={false}
                                    />
                                  ) : (
                                    <span className="text-[10px] text-slate-500">Missing</span>
                                  )}
                                </div>
                              ) : (
                                <span className="font-bold text-sm tracking-wide sm:text-base pr-8 break-words leading-tight">
                                  {option.label}
                                </span>
                              )}
                            </div>

                            {/* Correct/Incorrect checks */}
                            {selectedAnswer !== null && isSelected && (
                              <div className="flex-shrink-0">
                                <Check className="h-5 w-5 text-emerald-400 stroke-[3]" />
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}
      </main>

      {/* Footer shortcut helper banner */}
      <footer className="w-full max-w-5xl mx-auto h-12 flex items-center justify-between text-xs text-slate-600 font-semibold border-t border-slate-900 mt-6 pt-4">
        <span>Keyboard: Press 1-4 for instant answer submit</span>
        <div className="flex items-center gap-3">
          {pendingSubmissionsCount > 0 && (
            <span className="text-amber-500 animate-pulse">
              Syncing answers ({pendingSubmissionsCount} pending)...
            </span>
          )}
          {failedSubmissionsCount > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => void retryFailedSubmissions()}
              disabled={isRetryingFailed}
              className="h-7 border-amber-600/40 text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
            >
              {isRetryingFailed ? "Retrying..." : `Retry sync (${failedSubmissionsCount})`}
            </Button>
          )}
        </div>
      </footer>
    </div>
  );
}
