import type { Metadata } from "next";
import { fetchQuery } from "convex/nextjs";

import { api } from "@/convex/_generated/api";
import { UpdatesHero } from "@/components/updates/updates-hero";
import { isUpdatesTab, UpdatesTabs } from "@/components/updates/updates-tabs";
import { STAGE_BADGE_COLORS } from "@/lib/content/badge-colors";
import { getInDevelopmentItems } from "@/lib/content/in-development";
import { getRoadmapData } from "@/lib/content/roadmap";
import type { ChangelogEntry, Stage } from "@/lib/content/types";

export const metadata: Metadata = {
  title: "Development Updates & Roadmap",
  description:
    "See what's shipped, what's actively being built, and what's planned next for Signals Master — the naval signal flag learning platform for Oakville Sea Cadets.",
  openGraph: {
    title: "Development Updates & Roadmap | Signals Master",
    description:
      "Track new features, active development, and the upcoming roadmap for Signals Master.",
    type: "website",
  },
};

// Devlogs now live in Convex (US7), so the page can no longer be fully static.
export const revalidate = 60;

const STAGE_VALUES = Object.keys(STAGE_BADGE_COLORS) as Stage[];

function isStage(value: string): value is Stage {
  return (STAGE_VALUES as string[]).includes(value);
}

/**
 * Public, no-auth `/updates` page (FR-005/FR-006). Renders within the existing marketing
 * layout's `SiteHeader`/`SiteFooter` chrome, with the initial active tab resolved server-side
 * from the `?tab=` query param (FR-028), matching the `app/(marketing)/legal/page.tsx` pattern.
 * The `?stage=` query param (FR-032/FR-034) is resolved the same way for the "Latest Updates"
 * filter, and the changelog data itself now comes from Convex (`devlogs` table) rather than
 * Markdown, per FR-026/SC-007.
 */
export default async function UpdatesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; stage?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const requestedTab = resolvedSearchParams.tab;
  const activeTab = requestedTab && isUpdatesTab(requestedTab) ? requestedTab : "latest";
  const requestedStage = resolvedSearchParams.stage;
  const stage: Stage | "all" = requestedStage && isStage(requestedStage) ? requestedStage : "all";

  const [devlogs, inDevelopmentItems, roadmapData] = await Promise.all([
    fetchQuery(api.devlogs.listDevlogs, {}),
    getInDevelopmentItems(),
    getRoadmapData(),
  ]);

  // Adapter: `ChangelogTimeline`/`ChangelogEntryCard` still expect the Markdown-era
  // `ChangelogEntry` shape; T104-T106 retire this once they consume Convex docs directly.
  const changelogEntries: ChangelogEntry[] = devlogs.map((devlog) => ({
    slug: devlog._id,
    version: devlog.version,
    date: devlog.date,
    title: devlog.title,
    stage: devlog.stage,
    category: devlog.category,
    body: devlog.body,
  }));

  return (
    <div className="container mx-auto max-w-5xl px-4 py-10 md:px-6 md:py-16">
      <UpdatesHero />
      <UpdatesTabs
        defaultTab={activeTab}
        stage={stage}
        changelogEntries={changelogEntries}
        inDevelopmentItems={inDevelopmentItems}
        roadmapData={roadmapData}
      />
    </div>
  );
}
