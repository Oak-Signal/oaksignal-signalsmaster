import { AdminRecentExamAttemptsSection } from "@/components/admin/admin-recent-exam-attempts-section"

export default function AdminFlaggedExamsPage() {
  return (
    <div className="flex flex-col space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Flagged Exams</h2>
        <p className="text-muted-foreground">
          Focus on official exam attempts with suspicious integrity signals for investigation.
        </p>
      </div>

      <AdminRecentExamAttemptsSection
        enforcedFilters={{
          flaggedOnly: true,
        }}
      />
    </div>
  )
}
