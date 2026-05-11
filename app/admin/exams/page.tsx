import { AdminRecentExamAttemptsSection } from "@/components/admin/admin-recent-exam-attempts-section"

export default function AdminExamManagementPage() {
  return (
    <div className="flex flex-col space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Exam Management</h2>
        <p className="text-muted-foreground">
          Review recent official exam attempts and monitor cadet assessment outcomes.
        </p>
      </div>

      <AdminRecentExamAttemptsSection />
    </div>
  )
}
