import Link from "next/link"
import { BarChart3, ClipboardList, ShieldCheck } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const sections = [
  {
    title: "Exam Management",
    description: "Manage official exam settings, review readiness controls, and prepare next-stage administration tools.",
    href: "/admin/exams",
    icon: ShieldCheck,
    cta: "Open Exam Management",
  },
  {
    title: "Access Logs",
    description: "Review administrator access attempts and security-sensitive actions once audit logging is enabled.",
    href: "/admin/access",
    icon: ClipboardList,
    cta: "Open Access Logs",
  },
] as const

export default function AdminHomePage() {
  return (
    <div className="flex flex-col space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Badge variant="secondary">Admin Workspace</Badge>
            <Badge variant="outline">RBAC Enabled</Badge>
          </div>
          <h2 className="text-3xl font-bold tracking-tight">Admin Dashboard</h2>
          <p className="text-muted-foreground">
            Secure workspace for exam administration, governance, and upcoming oversight workflows.
          </p>
        </div>
        <Button asChild>
          <Link href="/api/admin/access-check">Verify API Access</Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {sections.map(({ title, description, href, icon: Icon, cta }) => (
          <Card key={title} className="border-border/70">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Icon className="h-5 w-5 text-primary" />
                {title}
              </CardTitle>
              <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline">
                <Link href={href}>{cta}</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <BarChart3 className="h-5 w-5 text-primary" />
            Next Story Readiness
          </CardTitle>
          <CardDescription>
            This layout is intentionally minimal and ready for exam overview statistics components in the next child issue.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  )
}
