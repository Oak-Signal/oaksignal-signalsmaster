"use client";

import { Hammer, Map as MapIcon, Rss } from "lucide-react";

import { ChangelogEmptyState } from "@/components/updates/changelog-empty-state";
import { ChangelogTimeline } from "@/components/updates/changelog-timeline";
import { InDevelopmentCard } from "@/components/updates/in-development-card";
import { InDevelopmentEmptyState } from "@/components/updates/in-development-empty-state";
import { RoadmapEmptyState } from "@/components/updates/roadmap-empty-state";
import { RoadmapSection } from "@/components/updates/roadmap-section";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ChangelogEntry, InDevelopmentItem, RoadmapData, Stage } from "@/lib/content/types";

/** The three navigable sections of `/updates`, per FR-009. */
export const UPDATES_TABS = ["latest", "in-development", "roadmap"] as const;
export type UpdatesTab = (typeof UPDATES_TABS)[number];

export function isUpdatesTab(value: string): value is UpdatesTab {
  return (UPDATES_TABS as readonly string[]).includes(value);
}

interface UpdatesTabsProps {
  /** Initial active tab, resolved server-side from the `?tab=` query param (FR-028). */
  defaultTab: UpdatesTab;
  /** Current `?stage=` filter, resolved server-side (FR-032/FR-034). Wired up in T104-T106. */
  stage?: Stage | "all";
  /** Changelog entries (already newest-first), fetched server-side in `page.tsx`. */
  changelogEntries: ChangelogEntry[];
  /** In-development items (already order-sorted), fetched server-side in `page.tsx`. */
  inDevelopmentItems: InDevelopmentItem[];
  /** Roadmap groups + intro body, fetched server-side in `page.tsx`. */
  roadmapData: RoadmapData;
}

/**
 * Client-side tab orchestrator for `/updates`. Wraps Shadcn `Tabs` (Radix under the hood), which
 * already provides correct tablist/tab/tabpanel ARIA semantics and keyboard operability (FR-009).
 *
 * The "Latest Updates", "In Development", and "Roadmap" panels are all fully wired to real
 * content (US3/US4/US5).
 */
export function UpdatesTabs({
  defaultTab,
  changelogEntries,
  inDevelopmentItems,
  roadmapData,
}: UpdatesTabsProps) {
  const hasRoadmapContent =
    Object.keys(roadmapData.groups).length > 0 || roadmapData.introBody.trim().length > 0;
  return (
    <Tabs defaultValue={defaultTab} className="w-full">
      <TabsList className="mb-8 grid h-auto w-full grid-cols-3 gap-1 p-1">
        <TabsTrigger value="latest" className="gap-1.5 py-2 text-xs sm:text-sm">
          <Rss className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">Latest Updates</span>
          <span className="sm:hidden">Latest</span>
        </TabsTrigger>
        <TabsTrigger value="in-development" className="gap-1.5 py-2 text-xs sm:text-sm">
          <Hammer className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">In Development</span>
          <span className="sm:hidden">In Dev</span>
        </TabsTrigger>
        <TabsTrigger value="roadmap" className="gap-1.5 py-2 text-xs sm:text-sm">
          <MapIcon className="h-4 w-4" aria-hidden="true" />
          Roadmap
        </TabsTrigger>
      </TabsList>

      <TabsContent value="latest">
        {changelogEntries.length > 0 ? (
          <ChangelogTimeline entries={changelogEntries} />
        ) : (
          <ChangelogEmptyState />
        )}
      </TabsContent>
      <TabsContent value="in-development">
        {inDevelopmentItems.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {inDevelopmentItems.map((item) => (
              <InDevelopmentCard key={item.slug} item={item} />
            ))}
          </div>
        ) : (
          <InDevelopmentEmptyState />
        )}
      </TabsContent>
      <TabsContent value="roadmap">
        {hasRoadmapContent ? <RoadmapSection data={roadmapData} /> : <RoadmapEmptyState />}
      </TabsContent>
    </Tabs>
  );
}
