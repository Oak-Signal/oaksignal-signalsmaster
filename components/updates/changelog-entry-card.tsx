import { CategoryBadge } from "@/components/updates/category-badge";
import { MarkdownBody } from "@/components/updates/markdown-body";
import { StageBadge } from "@/components/updates/stage-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { ChangelogEntry } from "@/lib/content/types";

function formatEntryDate(dateStr: string): string {
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) {
    return dateStr;
  }
  // `dateStr` is a date-only ISO string (e.g. "2026-06-01"), which parses as UTC midnight.
  // Format in UTC too, otherwise a negative-offset local timezone shifts the displayed day back.
  return parsed.toLocaleDateString("en-CA", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

interface ChangelogEntryCardProps {
  entry: ChangelogEntry;
}

/**
 * Renders a single changelog entry: version badge, title, date, stage badge, category badge, and
 * the entry's rendered Markdown body — per FR-010/FR-011. An empty/whitespace-only body renders
 * without error (frontmatter-only entries are valid, per FR-005).
 */
export function ChangelogEntryCard({ entry }: ChangelogEntryCardProps) {
  const hasBody = entry.body.trim().length > 0;

  return (
    <Card className="gap-4 transition-shadow hover:shadow-md focus-within:shadow-md">
      <CardHeader className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="font-mono">
            {entry.version}
          </Badge>
          <StageBadge stage={entry.stage} />
          <CategoryBadge category={entry.category} />
        </div>
        <div className="space-y-1">
          <h3 className="text-lg font-semibold tracking-tight sm:text-xl">{entry.title}</h3>
          <time dateTime={entry.date} className="block text-sm text-muted-foreground">
            {formatEntryDate(entry.date)}
          </time>
        </div>
      </CardHeader>
      {hasBody && (
        <CardContent>
          <MarkdownBody body={entry.body} />
        </CardContent>
      )}
    </Card>
  );
}
