"use client"

import { useEffect } from "react"

interface GlobalErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

// Root-level fallback: catches errors thrown outside any nested error.tsx
// (e.g. in the root layout) so users see a recoverable screen instead of blank.
export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    console.error("Global application error:", error)
  }, [error])

  return (
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center px-4 py-10 antialiased">
        <div className="w-full max-w-md rounded-lg border border-border/70 bg-background p-6 text-center shadow-sm">
          <h1 className="text-2xl font-bold tracking-tight">Something went wrong</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            The application hit an unexpected error. Please try again.
          </p>
          <button
            onClick={() => reset()}
            className="mt-4 inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Try Again
          </button>
        </div>
      </body>
    </html>
  )
}
