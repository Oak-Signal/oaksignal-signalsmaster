import Link from "next/link"

import { AdminRecentExamAttemptsSection } from "@/components/admin/admin-recent-exam-attempts-section"
import { AdminIntegrityOpsPanel } from "@/components/admin/admin-integrity-ops-panel"
import { AdminSystemConfigPanel } from "@/components/admin/admin-system-config-panel"
import { AdminExamTemplatesPanel } from "@/components/admin/admin-exam-templates-panel"
import { AdminSystemHealthPanel } from "@/components/admin/admin-system-health-panel"
import { AdminActionLogsPanel } from "@/components/admin/admin-action-logs-panel"
import { Button } from "@/components/ui/button"

export default function AdminExamManagementPage() {
  return (
    <div className="flex flex-col space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Exam Management</h2>
        <p className="text-muted-foreground">
          Configure exam operations, monitor system health, and review official exam outcomes.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href="#system-health">System Health</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href="#exam-config">Exam Config</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href="#exam-templates">Templates</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href="#admin-action-logs">Action Logs</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href="#integrity-ops">Integrity Ops</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href="#recent-attempts">Recent Attempts</Link>
        </Button>
      </div>

      <section id="system-health" className="scroll-mt-24" aria-label="System health section">
        <AdminSystemHealthPanel />
      </section>

      <section id="exam-config" className="scroll-mt-24" aria-label="Exam config section">
        <AdminSystemConfigPanel />
      </section>

      <section id="exam-templates" className="scroll-mt-24" aria-label="Exam templates section">
        <AdminExamTemplatesPanel />
      </section>

      <section id="admin-action-logs" className="scroll-mt-24" aria-label="Admin action logs section">
        <AdminActionLogsPanel />
      </section>

      <section id="integrity-ops" className="scroll-mt-24" aria-label="Integrity operations section">
        <AdminIntegrityOpsPanel />
      </section>

      <section id="recent-attempts" className="scroll-mt-24" aria-label="Recent attempts section">
        <AdminRecentExamAttemptsSection />
      </section>
    </div>
  )
}
