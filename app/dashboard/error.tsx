"use client"

import { useEffect } from "react"
import Link from "next/link"
import { AlertTriangle, Home, RotateCw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface DashboardErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

// Route-segment error boundary: without this, an uncaught render error (e.g. a
// hydration failure) leaves the whole dashboard blank instead of recoverable.
export default function DashboardError({ error, reset }: DashboardErrorProps) {
  useEffect(() => {
    console.error("Dashboard route error:", error)
  }, [error])

  return (
    <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-10">
      <Card className="w-full max-w-2xl border-border/70 shadow-sm">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-destructive/30 bg-destructive/10 text-destructive">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <CardTitle className="text-3xl tracking-tight">Something went wrong</CardTitle>
          <CardDescription className="text-base">
            This page hit an unexpected error. You can try again, or head back to your dashboard.
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Button onClick={() => reset()}>
            <RotateCw className="mr-2 h-4 w-4" />
            Try Again
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard">
              <Home className="mr-2 h-4 w-4" />
              Return To Dashboard
            </Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}
