"use client";

import { useMutation, useQuery } from "convex/react";

import { api } from "@/convex/_generated/api";
import { useToast } from "@/hooks/use-toast";
import { RankedEntryContext } from "@/lib/ranked-types";

const START_CONFIRMATION_TOKEN = "BEGIN_RANKED_RUN";

function normalizeRankedContext(data: unknown): RankedEntryContext | null {
  if (data === null || data === undefined) {
    return null;
  }

  return data as RankedEntryContext;
}

export function useRankedEntryData() {
  const { toast } = useToast();
  const contextQuery = useQuery(api.ranked.getRankedEntryContext, {});
  const startRankedRun = useMutation(api.ranked.startRankedRun);

  const startRun = async () => {
    try {
      const result = await startRankedRun({
        confirmationToken: START_CONFIRMATION_TOKEN,
      });

      toast({
        title: "Ranked run started",
        description: `Run initialized with ${result.flagCount} flags. Session ID: ${result.runId}`,
      });

      return result;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to start ranked run.";

      toast({
        title: "Unable to start ranked run",
        description: message,
        variant: "destructive",
      });

      throw error;
    }
  };

  return {
    context: normalizeRankedContext(contextQuery),
    isLoading: contextQuery === undefined,
    isSignedOut: contextQuery === null,
    startRun,
  };
}
