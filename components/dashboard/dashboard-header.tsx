"use client"

import Link from "next/link"
import Image from "next/image"
import { formatDistanceToNow } from "date-fns"
import { Bell, MessageSquarePlus, Shield } from "lucide-react"
import { UserButton } from "@clerk/nextjs"
import { useMutation, useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ModeToggle } from "@/components/mode-toggle"

export function DashboardHeader() {
  const clerkEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)
  const user = useQuery(api.users.getCurrentUser)
  const notifications = useQuery(api.notifications.listMyNotifications, { limit: 8 })
  const markNotificationRead = useMutation(api.notifications.markNotificationRead)
  const markAllNotificationsRead = useMutation(api.notifications.markAllNotificationsRead)

  const openFeedbackWidget = () => {
    if (typeof window !== "undefined") {
      window.uj?.showWidget?.()
    }
  }

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead({})
    } catch {
      // Keep interaction non-blocking for header controls.
    }
  }

  const handleOpenNotification = async (notificationId: string) => {
    try {
      await markNotificationRead({ notificationId: notificationId as Id<"notifications"> })
    } catch {
      // Keep interaction non-blocking for header controls.
    }
  }

  const unreadCount = notifications?.unreadCount ?? 0

  return (
    <header className="sticky top-0 z-30 w-full border-b bg-background px-4 py-3 sm:px-6">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-xl font-bold tracking-tight text-primary">
          <Image src="/flag.svg" alt="Signals Master logo" width={32} height={32} className="h-8 w-8" priority />
          <span className="hidden sm:inline">Signals Master</span>
        </div>

        <nav className="ml-4 hidden items-center gap-6 text-sm font-medium md:flex">
          <Link href="/dashboard" className="text-foreground transition-colors hover:text-primary">
            Dashboard
          </Link>
          <Link href="/dashboard/practice" className="text-muted-foreground transition-colors hover:text-primary">
            Practice
          </Link>
          <Link href="/dashboard/exam" className="text-muted-foreground transition-colors hover:text-primary">
            Exam
          </Link>
          <Link href="/dashboard/ranked" className="text-muted-foreground transition-colors hover:text-primary">
            Ranked
          </Link>
          <Link href="/dashboard/analytics" className="text-muted-foreground transition-colors hover:text-primary">
            Analytics
          </Link>
          <Link href="/dashboard/reference" className="text-muted-foreground transition-colors hover:text-primary">
            Reference
          </Link>
        </nav>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          {user?.role === "admin" ? (
            <>
              <Button
                asChild
                size="sm"
                className="hidden border border-red-200/30 bg-linear-to-r from-red-600 via-red-500 to-rose-500 font-semibold text-white shadow-sm hover:from-red-500 hover:via-red-400 hover:to-rose-400 md:inline-flex"
              >
                <Link href="/admin">
                  <Shield className="mr-2 h-4 w-4" />
                  Admin Console
                </Link>
              </Button>
              <Button
                asChild
                size="icon"
                className="border border-red-200/30 bg-linear-to-r from-red-600 via-red-500 to-rose-500 text-white hover:from-red-500 hover:via-red-400 hover:to-rose-400 md:hidden"
              >
                <Link href="/admin">
                  <Shield className="h-4 w-4" />
                  <span className="sr-only">Admin Console</span>
                </Link>
              </Button>
            </>
          ) : null}

          <ModeToggle />
          <Button variant="ghost" size="icon" onClick={openFeedbackWidget}>
            <MessageSquarePlus className="h-5 w-5" />
            <span className="sr-only">Open feedback</span>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative" aria-label="Open notifications">
                <Bell className="h-5 w-5" />
                {unreadCount > 0 ? (
                  <span className="absolute right-1.5 top-1.5 inline-flex min-h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                ) : null}
                <span className="sr-only">Notifications</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <div className="flex items-center justify-between gap-2 px-2 py-1.5">
                <DropdownMenuLabel className="p-0">Notifications</DropdownMenuLabel>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => void handleMarkAllRead()}
                  disabled={!notifications || unreadCount === 0}
                  aria-label="Mark all notifications as read"
                >
                  Mark all read
                </Button>
              </div>
              <DropdownMenuSeparator />

              {notifications === undefined ? (
                <div className="px-2 py-3 text-sm text-muted-foreground">Loading notifications...</div>
              ) : notifications === null ? (
                <div className="px-2 py-3 text-sm text-muted-foreground">Sign in to view notifications.</div>
              ) : notifications.items.length === 0 ? (
                <div className="px-2 py-3 text-sm text-muted-foreground">No notifications yet.</div>
              ) : (
                notifications.items.map((notification) => (
                  <DropdownMenuItem
                    key={notification.notificationId}
                    className="items-start"
                    onSelect={() => {
                      void handleOpenNotification(notification.notificationId)
                    }}
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium leading-tight">{notification.title}</span>
                        {notification.readAt === undefined ? (
                          <span className="inline-block h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
                        ) : null}
                      </div>
                      <p className="text-xs text-muted-foreground">{notification.message}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {formatDistanceToNow(notification.createdAt, { addSuffix: true })}
                      </p>
                    </div>
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="ml-1 flex items-center gap-3 border-l pl-3">
            {user ? (
              <div className="hidden md:flex flex-col items-end">
                <span className="text-sm font-medium leading-none">{user.name}</span>
                <span className="text-xs text-muted-foreground uppercase tracking-wider">
                  {user.role}
                </span>
              </div>
            ) : null}
            {clerkEnabled ? <UserButton afterSignOutUrl="/logout" /> : null}
          </div>
        </div>
      </div>

      <nav className="mt-3 flex gap-2 overflow-x-auto pb-1 md:hidden">
        <Button asChild variant="outline" size="sm" className="shrink-0">
          <Link href="/dashboard">Dashboard</Link>
        </Button>
        <Button asChild variant="outline" size="sm" className="shrink-0">
          <Link href="/dashboard/practice">Practice</Link>
        </Button>
        <Button asChild variant="outline" size="sm" className="shrink-0">
          <Link href="/dashboard/exam">Exam</Link>
        </Button>
        <Button asChild variant="outline" size="sm" className="shrink-0">
          <Link href="/dashboard/ranked">Ranked</Link>
        </Button>
        <Button asChild variant="outline" size="sm" className="shrink-0">
          <Link href="/dashboard/analytics">Analytics</Link>
        </Button>
        <Button asChild variant="outline" size="sm" className="shrink-0">
          <Link href="/dashboard/reference">Reference</Link>
        </Button>
        {user?.role === "admin" ? (
          <Button asChild size="sm" className="shrink-0 bg-linear-to-r from-red-600 via-red-500 to-rose-500 text-white hover:from-red-500 hover:via-red-400 hover:to-rose-400">
            <Link href="/admin">Admin</Link>
          </Button>
        ) : null}
      </nav>
    </header>
  )
}
