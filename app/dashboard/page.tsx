import {
  BookOpen,
  GraduationCap,
  Trophy,
  Flag,
} from "lucide-react"
import Link from "next/link"

import { StatsOverview } from "@/components/dashboard/stats-overview"
import { ModuleCard } from "@/components/dashboard/module-card"
import { RecentActivity } from "@/components/dashboard/recent-activity"
import { DashboardPerformanceTrend } from "@/components/dashboard/dashboard-performance-trend"
import { Button } from "@/components/ui/button"

// TODO: Add Convex query for current user
// const currentUser = useQuery(api.users.getCurrentUser)

export default function DashboardPage() {
  return (
    <div className="flex flex-col space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between space-y-2 md:space-y-0">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-muted-foreground">
            Welcome back. Ready to master some flags?
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button asChild>
            <Link href="/dashboard/practice">Quick Start Practice</Link>
          </Button>
        </div>
      </div>

      <StatsOverview />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <ModuleCard
          title="Practice Mode"
          description="Customizable learning sessions. Focus on specific flags."
          icon={Flag}
          href="/dashboard/practice"
          ctaText="Start Practice"
          variant="featured"
        />
        <ModuleCard
          title="Formal Exam"
          description="Official assessment with immutable results."
          icon={GraduationCap}
          href="/dashboard/exam"
          ctaText="Begin Exam"
        />
        <ModuleCard
          title="Ranked Challenge"
          description="Reflex-based competitive mode. Climb the leaderboard."
          icon={Trophy}
          href="/dashboard/ranked"
          ctaText="Enter Arena"
        />
        <ModuleCard
          title="Reference Guide"
          description="Complete encyclopedia of flags and meanings."
          icon={BookOpen}
          href="/dashboard/reference"
          ctaText="Browse Flags"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-7">
        <RecentActivity />
        <div className="col-span-1 md:col-span-2 lg:col-span-4">
          <DashboardPerformanceTrend />
        </div>
      </div>
    </div>
  )
}
