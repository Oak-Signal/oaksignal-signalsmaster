export type AnalyticsDateRange = "7d" | "30d" | "all";

export function dateRangeCutoff(range: AnalyticsDateRange): number {
  if (range === "all") {
    return 0;
  }

  const days = range === "7d" ? 7 : 30;
  return Date.now() - days * 24 * 60 * 60 * 1000;
}
