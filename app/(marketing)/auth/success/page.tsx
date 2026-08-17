"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { CheckCircle2, Loader2 } from "lucide-react";

import { api } from "@/convex/_generated/api";
import { StatusTransitionCard } from "@/components/transitions/status-transition-card";

const REDIRECT_DELAY_MS = 1800;
const SUCCESS_VISUAL_LEAD_MS = 420;

function resolveDestination(role: "cadet" | "admin" | null | undefined): "/dashboard" | "/admin" {
  return role === "admin" ? "/admin" : "/dashboard";
}

export default function AuthSuccessPage() {
  const router = useRouter();
  const user = useQuery(api.users.getCurrentUser);

  const [elapsedMs, setElapsedMs] = useState(0);
  const hasNavigatedRef = useRef(false);
  const destinationRef = useRef<"/dashboard" | "/admin">("/dashboard");

  const role = user?.role;
  const destination = resolveDestination(role);

  const cadetName = user?.name?.trim() || "Cadet";
  const cadetRank = user?.rank?.trim() || "Cadet in Training";

  const destinationLabel = destination === "/admin" ? "Admin Console" : "Dashboard";
  const profileLine = `${cadetName} · ${cadetRank}`;

  useEffect(() => {
    destinationRef.current = destination;
  }, [destination]);

  const handleTransition = useCallback(() => {
    if (hasNavigatedRef.current) {
      return;
    }

    hasNavigatedRef.current = true;
    router.replace(destinationRef.current);
  }, [router]);

  useEffect(() => {
    const startedAt = Date.now();

    const timeout = setTimeout(() => {
      handleTransition();
    }, REDIRECT_DELAY_MS);

    const interval = setInterval(() => {
      const nextElapsed = Math.min(Date.now() - startedAt, REDIRECT_DELAY_MS);
      setElapsedMs(nextElapsed);
    }, 100);

    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [handleTransition]);

  const remainingMs = Math.max(0, REDIRECT_DELAY_MS - elapsedMs);
  const secondsLeft = (remainingMs / 1000).toFixed(1);

  const progressValue = useMemo(
    () => Math.min(100, (elapsedMs / REDIRECT_DELAY_MS) * 100),
    [elapsedMs]
  );

  const buttonState = elapsedMs >= REDIRECT_DELAY_MS - SUCCESS_VISUAL_LEAD_MS ? "success" : "loading";

  return (
    <StatusTransitionCard
      title="Welcome to Signals Master"
      primaryLine={profileLine}
      secondaryLine={`Redirecting to ${destinationLabel} in ${secondsLeft}s`}
      liveMessage={`Login successful. Redirecting to ${destinationLabel} in approximately ${secondsLeft} seconds.`}
      progressValue={progressValue}
      progressAriaLabel="Redirect progress"
      buttonState={buttonState}
      buttonLoadingLabel="Syncing Session"
      buttonSuccessLabel="Continue"
      onContinue={handleTransition}
      centerLoadingIcon={<Loader2 className="h-6 w-6 animate-spin" />}
      centerSuccessIcon={<CheckCircle2 className="h-6 w-6" />}
      buttonLoadingIcon={<Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      buttonSuccessIcon={<CheckCircle2 className="mr-2 h-4 w-4" />}
      iconToneClassName="border border-emerald-500/30 bg-emerald-500/10 text-emerald-600"
      glowPrimaryClassName="bg-sky-500/10"
      glowSecondaryClassName="bg-cyan-500/10"
    />
  );
}
