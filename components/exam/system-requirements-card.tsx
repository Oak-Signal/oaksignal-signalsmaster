import { AlertCircle, MonitorCog, UserRoundCheck } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface SystemRequirementsCardProps {
  stableInternetRequired: boolean
  recommendedBrowsers: string[]
  proctorInfo: {
    instructorName: string
    scheduledStartAt: number
    instructions?: string
  } | null
}

export function SystemRequirementsCard({
  stableInternetRequired,
  recommendedBrowsers,
  proctorInfo,
}: SystemRequirementsCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <MonitorCog className="h-5 w-5" />
          System & Proctor Information
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 text-amber-600" />
            <span>
              {stableInternetRequired
                ? "A stable internet connection is required throughout the exam."
                : "Internet connectivity recommendations are advisory for this assessment."}
            </span>
          </div>
        </div>

        <div className="rounded-md border p-3">
          <p className="font-medium">Recommended browsers</p>
          <p className="mt-1 text-muted-foreground">{recommendedBrowsers.join(", ")}</p>
        </div>

        <div className="rounded-md border p-3">
          <div className="mb-2 flex items-center gap-2">
            <UserRoundCheck className="h-4 w-4 text-primary" />
            <p className="font-medium">Proctor details</p>
          </div>
          {proctorInfo ? (
            <div className="space-y-1 text-muted-foreground">
              <p>Instructor: {proctorInfo.instructorName}</p>
              <p>Scheduled start: {new Date(proctorInfo.scheduledStartAt).toLocaleString()}</p>
              {proctorInfo.instructions && <p>Notes: {proctorInfo.instructions}</p>}
            </div>
          ) : (
            <p className="text-muted-foreground">No proctor assignment is currently configured.</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
