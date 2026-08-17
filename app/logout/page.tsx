"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, LogOut } from "lucide-react";

import { StatusTransitionCard } from "@/components/transitions/status-transition-card";

const SIGNOUT_PROGRESS_WINDOW_MS = 1200;
const SUCCESS_REDIRECT_DELAY_MS = 520;

type LogoutPhase = "signing-out" | "success";

export default function LogoutPage() {
  const router = useRouter();

  const [phase, setPhase] = useState<LogoutPhase>("signing-out");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [successAtMs, setSuccessAtMs] = useState<number | null>(null);

  const hasNavigatedRef = useRef(false);
  const startedAtRef = useRef<number>(0);

  const handleTransition = useCallback(() => {
    if (hasNavigatedRef.current) {
      return;
    }

    hasNavigatedRef.current = true;
    router.replace("/");
  }, [router]);

  useEffect(() => {
    startedAtRef.current = Date.now();

    const interval = setInterval(() => {
      setElapsedMs(Date.now() - startedAtRef.current);
    }, 80);

    return () => {
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const handleLogout = async () => {
      const clerk = (window as unknown as { Clerk?: { signOut: () => Promise<void> } }).Clerk;

      if (clerk?.signOut) {
        try {
          await clerk.signOut();
        } catch {
          // Keep UX stable even if signOut fails transiently.
        }
      }

      const nowElapsed = Date.now() - startedAtRef.current;
      setPhase("success");
      setSuccessAtMs(nowElapsed);

      setTimeout(() => {
        handleTransition();
      }, SUCCESS_REDIRECT_DELAY_MS);
    };

    void handleLogout();

    return undefined;
  }, [handleTransition]);

  const successElapsed = successAtMs === null ? 0 : Math.max(0, elapsedMs - successAtMs);
  const secondsLeft = Math.max(0, (SUCCESS_REDIRECT_DELAY_MS - successElapsed) / 1000).toFixed(1);

  const progressValue = useMemo(() => {
    if (phase === "signing-out") {
      const base = Math.min(85, (elapsedMs / SIGNOUT_PROGRESS_WINDOW_MS) * 85);
      return Math.max(12, base);
    }

    const tail = Math.min(15, (successElapsed / SUCCESS_REDIRECT_DELAY_MS) * 15);
    return Math.min(100, 85 + tail);
  }, [phase, elapsedMs, successElapsed]);

  return (
    <StatusTransitionCard
      title={phase === "signing-out" ? "Signing Out" : "Signed Out"}
      primaryLine="Session ended securely."
      secondaryLine={`Redirecting home in ${secondsLeft}s`}
      liveMessage={
        phase === "signing-out"
          ? "Signing out. Redirecting to home shortly."
          : `Signed out. Redirecting to home in approximately ${secondsLeft} seconds.`
      }
      progressValue={progressValue}
      progressAriaLabel="Sign-out progress"
      buttonState={phase === "signing-out" ? "loading" : "success"}
      buttonLoadingLabel="Ending Session"
      buttonSuccessLabel="Continue Home"
      onContinue={handleTransition}
      centerLoadingIcon={<LogOut className="h-6 w-6" />}
      centerSuccessIcon={<CheckCircle2 className="h-6 w-6" />}
      buttonLoadingIcon={<Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      buttonSuccessIcon={<CheckCircle2 className="mr-2 h-4 w-4" />}
      iconToneClassName="border border-amber-500/30 bg-amber-500/10 text-amber-600"
      glowPrimaryClassName="bg-amber-500/10"
      glowSecondaryClassName="bg-rose-500/10"
    />
  );
}
