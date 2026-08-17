"use client";

import { motion, useReducedMotion } from "framer-motion";

import { ChangelogEntryCard } from "@/components/updates/changelog-entry-card";
import type { ChangelogEntry } from "@/lib/content/types";

interface ChangelogTimelineProps {
  entries: ChangelogEntry[];
}

/**
 * Renders changelog entries (already newest-first from Convex's `listDevlogs`/`listDevlogsByStage`)
 * as a vertical connecting-line timeline with a staggered entrance, per FR-010/FR-013.
 *
 * The staggered entrance respects `prefers-reduced-motion` via `useReducedMotion()` (FR-014): when
 * reduced motion is preferred, entries render at their final, fully-visible state immediately
 * with no transform/opacity animation. In both cases every entry is unconditionally present in
 * the DOM — only the *animation*, never the content, is gated.
 */
export function ChangelogTimeline({ entries }: ChangelogTimelineProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <ol className="relative space-y-8 border-l border-border pl-6 sm:pl-8">
      {entries.map((entry, index) => (
        <motion.li
          key={entry._id}
          className="relative"
          initial={shouldReduceMotion ? false : { opacity: 0, y: 16 }}
          whileInView={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={
            shouldReduceMotion ? { duration: 0 } : { duration: 0.4, delay: index * 0.08 }
          }
        >
          <span
            aria-hidden="true"
            className="absolute top-2 -left-[29px] h-3 w-3 rounded-full border-2 border-background bg-primary sm:-left-[37px]"
          />
          <ChangelogEntryCard entry={entry} />
        </motion.li>
      ))}
    </ol>
  );
}
