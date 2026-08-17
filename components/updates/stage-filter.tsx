"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "convex/react";

import { api } from "@/convex/_generated/api";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { STAGE_BADGE_COLORS } from "@/lib/content/badge-colors";
import type { Stage } from "@/lib/content/types";

const STAGE_VALUES = Object.keys(STAGE_BADGE_COLORS) as Stage[];

interface StageFilterProps {
  /** Current `?stage=` value, resolved server-side (defaults to `"all"`). */
  stage: Stage | "all";
}

/**
 * Dropdown filter for the "Latest Updates" tab, with live per-stage counts (FR-032/FR-033).
 * Selecting a value updates the `?stage=` URL param (FR-034), preserving `?tab=` and any other
 * existing params.
 */
export function StageFilter({ stage }: StageFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const counts = useQuery(api.devlogs.getDevlogStageCounts, {});
  const totalCount = counts && Object.values(counts).reduce((sum, count) => sum + count, 0);

  function handleValueChange(nextStage: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (nextStage === "all") {
      params.delete("stage");
    } else {
      params.set("stage", nextStage);
    }
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  return (
    <Select value={stage} onValueChange={handleValueChange}>
      <SelectTrigger
        className="w-full sm:w-[240px]"
        aria-label="Filter Latest Updates by development stage"
      >
        <SelectValue placeholder="All stages">
          {stage === "all" ? `All${totalCount !== undefined ? ` (${totalCount})` : ""}` : stage}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All{totalCount !== undefined ? ` (${totalCount})` : ""}</SelectItem>
        {STAGE_VALUES.map((stageValue) => (
          <SelectItem key={stageValue} value={stageValue}>
            {stageValue}
            {counts ? ` (${counts[stageValue]})` : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
