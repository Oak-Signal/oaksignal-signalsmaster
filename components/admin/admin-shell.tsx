"use client"

import { AdminHeader } from "@/components/admin/admin-header"
import { UserjotWidget } from "@/components/userjot-widget"
import { Toaster } from "@/components/ui/toaster"

interface AdminShellProps {
  children: React.ReactNode
}

export function AdminShell({ children }: AdminShellProps) {
  return (
    <div className="flex min-h-screen flex-col">
      <UserjotWidget />
      <AdminHeader />
      <main className="flex-1 space-y-4 p-8 pt-6">{children}</main>
      <Toaster />
    </div>
  )
}
