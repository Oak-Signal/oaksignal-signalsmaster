import { Metadata } from "next";
import { AnalyticsPageClient } from "@/components/analytics/analytics-page-client";

export const metadata: Metadata = {
  title: "Analytics | Signals Master",
  description: "Track your progress and performance over time.",
};

export default function AnalyticsPage() {
  return <AnalyticsPageClient />;
}
