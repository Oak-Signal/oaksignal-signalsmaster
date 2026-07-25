import { AdminRankedIntegrityPanel } from "@/components/admin/admin-ranked-integrity-panel"

export default function AdminRankedIntegrityPage() {
  return (
    <div className="flex flex-col space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Ranked Integrity Review</h2>
        <p className="text-muted-foreground">
          Triage ranked sessions flagged by the anti-cheat system and progress them through a
          review workflow.
        </p>
      </div>

      <AdminRankedIntegrityPanel />
    </div>
  )
}
