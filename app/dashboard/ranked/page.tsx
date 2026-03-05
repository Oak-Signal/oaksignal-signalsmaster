import Link from "next/link"
import { Metadata } from "next"
import { Trophy, ArrowRight, Timer } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export const metadata: Metadata = {
  title: "Ranked Challenge | Signals Master",
  description:
    "Ranked challenge mode is being prepared. Practice and analytics remain available.",
}

export default function RankedPage() {
  return (
    <div className="container mx-auto max-w-4xl py-6 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Ranked Challenge</h1>
        <p className="text-muted-foreground">
          Competitive ranked sessions are not enabled in this build yet.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg border bg-background text-primary">
            <Trophy className="h-5 w-5" />
          </div>
          <CardTitle>Arena Setup In Progress</CardTitle>
          <CardDescription>
            Timed competitive play and leaderboard logic are being integrated.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Timer className="h-4 w-4" />
            <span>Ranked timers and scoring safeguards are not yet active.</span>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-2 sm:flex-row sm:justify-start">
          <Button asChild>
            <Link href="/dashboard/practice">
              Build Skills in Practice
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard/reference">Review Flags</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
