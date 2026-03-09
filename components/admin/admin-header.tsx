"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Shield, LayoutDashboard, ClipboardList } from "lucide-react"
import { UserButton } from "@clerk/nextjs"
import { useQuery } from "convex/react"

import { api } from "@/convex/_generated/api"
import { ModeToggle } from "@/components/mode-toggle"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const navItems = [
  {
    href: "/admin",
    label: "Overview",
    icon: LayoutDashboard,
  },
  {
    href: "/admin/exams",
    label: "Exam Management",
    icon: Shield,
  },
  {
    href: "/admin/access",
    label: "Access Logs",
    icon: ClipboardList,
  },
] as const

export function AdminHeader() {
  const pathname = usePathname()
  const clerkEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)
  const user = useQuery(api.users.getCurrentUser)

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center gap-4 border-b bg-background px-6">
      <div className="flex items-center gap-2 font-bold text-xl tracking-tight text-primary">
        <Image
          src="/flag.svg"
          alt="Signals Master logo"
          width={32}
          height={32}
          className="h-8 w-8"
          priority
        />
        <span>Signals Master</span>
        <Badge variant="secondary" className="ml-1 hidden sm:inline-flex">
          Admin
        </Badge>
      </div>

      <nav className="ml-4 hidden items-center gap-4 md:flex">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "inline-flex items-center gap-2 text-sm font-medium transition-colors hover:text-primary",
                isActive ? "text-foreground" : "text-muted-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="ml-auto flex items-center gap-3">
        <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex">
          <Link href="/dashboard">Back To User Dashboard</Link>
        </Button>
        <ModeToggle />

        <div className="ml-1 flex items-center gap-3 border-l pl-3">
          {user ? (
            <div className="hidden flex-col items-end md:flex">
              <span className="text-sm font-medium leading-none">{user.name}</span>
              <span className="text-xs uppercase tracking-wider text-muted-foreground">{user.role}</span>
            </div>
          ) : null}
          {clerkEnabled ? <UserButton afterSignOutUrl="/" /> : null}
        </div>
      </div>
    </header>
  )
}
