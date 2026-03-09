import { AdminShell } from "@/components/admin/admin-shell"

export const dynamic = "force-dynamic"

interface AdminLayoutProps {
  children: React.ReactNode
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  return <AdminShell>{children}</AdminShell>
}
