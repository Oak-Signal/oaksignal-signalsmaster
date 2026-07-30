"use client";

import { Hammer, Map as MapIcon, Rss } from "lucide-react";

import { ChangelogEmptyState } from "@/components/updates/changelog-empty-state";
import { ChangelogTimeline } from "@/components/updates/changelog-timeline";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ChangelogEntry } from "@/lib/content/types";

/** The three navigable sections of `/updates`, per FR-009. */
export const UPDATES_TABS = ["latest", "in-development", "roadmap"] as const;
export type UpdatesTab = (typeof UPDATES_TABS)[number];

export function isUpdatesTab(value: string): value is UpdatesTab {
  return (UPDATES_TABS as readonly string[]).includes(value);
}

interface UpdatesTabsProps {
  /** Initial active tab, resolved server-side from the `?tab=` query param (FR-028). */
  defaultTab: UpdatesTab;
  /** Changelog entries (already newest-first), fetched server-side in `page.tsx`. */
  changelogEntries: ChangelogEntry[];
}

/**
 * Client-side tab orchestrator for `/updates`. Wraps Shadcn `Tabs` (Radix under the hood), which
 * already provides correct tablist/tab/tabpanel ARIA semantics and keyboard operability (FR-009).
 *
 * The "Latest Updates" panel is fully wired to real content (US3). "In Development" / "Roadmap"
 * remain placeholders until their own user stories (US4/US5) wire them up.
 */
export function UpdatesTabs({ defaultTab, changelogEntries }: UpdatesTabsProps) {
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
        <UpdatesPlaceholderPanel message="Actively in-progress features will appear here soon." />
      </TabsContent>
      <TabsContent value="roadmap">
        <UpdatesPlaceholderPanel message="Planned features will appear here soon." />
      </TabsContent>
    </Tabs>
  );
}

function UpdatesPlaceholderPanel({ message }: { message: string }) {
  return (
    <Card>
      <CardContent className="py-12 text-center text-sm text-muted-foreground md:text-base">
        {message}
      </CardContent>
    </Card>
  );
}
