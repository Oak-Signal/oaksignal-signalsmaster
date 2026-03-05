"use client";

import { 
  CheckCircle2, 
  Clock,
  Target
} from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { formatDistanceToNow } from "date-fns"
import Link from "next/link"

export function RecentActivity() {
  const recentSessions = useQuery(api.analytics.getRecentSessions, { limit: 5 })

  return (
    <Card className="col-span-1 md:col-span-2 lg:col-span-3">
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
        <CardDescription>
          Your latest practice sessions and exam attempts.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {recentSessions === undefined ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-4 animate-pulse">
                <div className="h-10 w-10 bg-muted rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted w-1/3 rounded" />
                  <div className="h-3 bg-muted w-1/4 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : !recentSessions || recentSessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-muted-foreground border-2 border-dashed rounded-lg bg-muted/20">
            <Clock className="h-10 w-10 mb-4 opacity-50" />
            <p className="text-sm font-medium">No recent activity</p>
            <p className="text-xs mt-1">Complete a practice session to see your progress here</p>
          </div>
        ) : (
          <div className="space-y-4">
            {recentSessions.map((session) => {
              const isPerfect = session.score === session.totalQuestions;
              
              return (
                <Link 
                  key={session.sessionId}
                  href={`/dashboard/practice/session/${session.sessionId}/results`}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors gap-4"
                >
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-full ${
                      isPerfect ? 'bg-green-100 text-green-600 dark:bg-green-900/30' : 'bg-blue-100 text-blue-600 dark:bg-blue-900/30'
                    }`}>
                      {isPerfect ? <CheckCircle2 className="h-5 w-5" /> : <Target className="h-5 w-5" />}
                    </div>
                    <div>
                      <div className="font-medium flex items-center gap-2">
                        {session.mode === "learn" ? "Learn" : "Match"} Practice
                        <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground font-normal">
                          {session.sessionLength} Questions
                        </span>
                      </div>
                      <div className="text-sm text-muted-foreground mt-1 flex items-center gap-3">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {session.completedAt 
                            ? formatDistanceToNow(session.completedAt, { addSuffix: true })
                            : "Recently"}
                        </span>
                        {session.timeTaken && (
                          <span className="text-xs tabular-nums before:content-['•'] before:mr-3 before:opacity-50">
                            {Math.round(session.timeTaken / 1000)}s
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex text-right sm:block">
                    <div className="text-xl font-bold font-mono text-primary">
                      {Math.round((session.score / session.totalQuestions) * 100)}%
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {session.score}/{session.totalQuestions} correct
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
