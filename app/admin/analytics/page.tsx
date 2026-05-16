import { AdminPerformanceAnalyticsSection } from "@/components/admin/admin-performance-analytics-section"

export default function AdminAnalyticsPage() {
  return (
    <div className="flex flex-col space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Performance Analytics</h2>
        <p className="text-muted-foreground">
          Analyze exam performance trends, difficult signals, retake outcomes, and cohort comparisons.
        </p>
      </div>

      <AdminPerformanceAnalyticsSection />
    </div>
  )
}
