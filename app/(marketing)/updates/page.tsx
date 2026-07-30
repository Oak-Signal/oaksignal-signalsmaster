import type { Metadata } from "next";

import { UpdatesHero } from "@/components/updates/updates-hero";
import { isUpdatesTab, UpdatesTabs } from "@/components/updates/updates-tabs";
import { getChangelogEntries } from "@/lib/content/changelog";

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

/**
 * Public, no-auth `/updates` page (FR-005/FR-006). Renders within the existing marketing
 * layout's `SiteHeader`/`SiteFooter` chrome, with the initial active tab resolved server-side
 * from the `?tab=` query param (FR-028), matching the `app/(marketing)/legal/page.tsx` pattern.
 */
export default async function UpdatesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const requestedTab = resolvedSearchParams.tab;
  const activeTab = requestedTab && isUpdatesTab(requestedTab) ? requestedTab : "latest";

  const changelogEntries = await getChangelogEntries();

  return (
    <div className="container mx-auto max-w-5xl px-4 py-10 md:px-6 md:py-16">
      <UpdatesHero />
      <UpdatesTabs defaultTab={activeTab} changelogEntries={changelogEntries} />
    </div>
  );
}
