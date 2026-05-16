import { AdminRecentExamAttemptsSection } from "@/components/admin/admin-recent-exam-attempts-section"
import { AdminIntegrityOpsPanel } from "@/components/admin/admin-integrity-ops-panel"
import { AdminSystemConfigPanel } from "@/components/admin/admin-system-config-panel"
import { AdminExamTemplatesPanel } from "@/components/admin/admin-exam-templates-panel"
import { AdminSystemHealthPanel } from "@/components/admin/admin-system-health-panel"
import { AdminActionLogsPanel } from "@/components/admin/admin-action-logs-panel"

export default function AdminExamManagementPage() {
  return (
    <div className="flex flex-col space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Exam Management</h2>
        <p className="text-muted-foreground">
          Configure exam operations, monitor system health, and review official exam outcomes.
        </p>
      </div>

      <AdminSystemHealthPanel />

      <AdminSystemConfigPanel />

      <AdminExamTemplatesPanel />

      <AdminActionLogsPanel />

      <AdminIntegrityOpsPanel />

      <AdminRecentExamAttemptsSection />
    </div>
  )
}
