"use client"

import Link from "next/link"
import { Bell } from "lucide-react"
import { UserButton } from "@clerk/nextjs"
import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"

import { Button } from "@/components/ui/button"
import { ModeToggle } from "@/components/mode-toggle"

export function DashboardHeader() {
  const user = useQuery(api.users.getCurrentUser);

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center gap-4 border-b bg-background px-6">
      <div className="flex items-center gap-2 font-bold text-xl tracking-tight text-primary">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          S
        </span>
        Signals Master
      </div>
      <nav className="hidden md:flex items-center gap-6 ml-6 text-sm font-medium">
        <Link href="/dashboard" className="text-foreground transition-colors hover:text-primary">
          Dashboard
        </Link>
        <Link href="/dashboard/practice" className="text-muted-foreground transition-colors hover:text-primary">
          Practice
        </Link>
        <Link href="/dashboard/exam" className="text-muted-foreground transition-colors hover:text-primary">
          Exam
        </Link>
        <Link href="/dashboard/analytics" className="text-muted-foreground transition-colors hover:text-primary">
          Analytics
        </Link>
        <Link href="/dashboard/reference" className="text-muted-foreground transition-colors hover:text-primary">
          Reference
        </Link>
      </nav>
      <div className="ml-auto flex items-center gap-4">
        <ModeToggle />
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-destructive" />
          <span className="sr-only">Notifications</span>
        </Button>
        
        {/* User Info from Convex + Clerk UserButton */}
        <div className="flex items-center gap-3 pl-2 border-l ml-2">
          {user && (
            <div className="hidden md:flex flex-col items-end mr-1">
              <span className="text-sm font-medium leading-none">{user.name}</span>
              <span className="text-xs text-muted-foreground uppercase tracking-wider">
                {user.role}
              </span>
            </div>
          )}
          <UserButton afterSignOutUrl="/" />
        </div>
      </div>
    </header>
  )
}
