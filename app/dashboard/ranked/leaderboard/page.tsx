import { Metadata } from "next"
import { RankedLeaderboardPanel } from "@/components/ranked/ranked-leaderboard-panel"

export const metadata: Metadata = {
  title: "Ranked Leaderboard | Signals Master",
  description: "Live, season-scoped ranked leaderboard with fleet rank standings.",
}

export default function RankedLeaderboardPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Leaderboard</h1>
        <p className="text-muted-foreground max-w-3xl">
          Standings update in real time as cadets finalize ranked sessions.
        </p>
      </div>
      <RankedLeaderboardPanel />
    </div>
  )
}
