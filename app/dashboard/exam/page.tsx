import Link from "next/link"
import { Metadata } from "next"
import { GraduationCap, ArrowRight, Clock3 } from "lucide-react"

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
  title: "Formal Exam | Signals Master",
  description:
    "Formal exam mode is being finalized. Continue practicing while exam workflows are completed.",
}

export default function ExamPage() {
  return (
    <div className="container mx-auto max-w-4xl py-6 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Formal Exam</h1>
        <p className="text-muted-foreground">
          This module is currently being finalized for official, immutable assessment sessions.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg border bg-background text-primary">
            <GraduationCap className="h-5 w-5" />
          </div>
          <CardTitle>Exam Mode In Progress</CardTitle>
          <CardDescription>
            You can continue improving your readiness in Practice Mode and review your progress in Analytics.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Clock3 className="h-4 w-4" />
            <span>Official exam workflows are not yet enabled in this build.</span>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-2 sm:flex-row sm:justify-start">
          <Button asChild>
            <Link href="/dashboard/practice">
              Continue Practice
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard/analytics">View Analytics</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
