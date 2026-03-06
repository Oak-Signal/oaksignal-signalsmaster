import { ShieldCheck } from "lucide-react"

import { Badge } from "@/components/ui/badge"

interface OfficialExamHeaderProps {
  motivationalMessage: string
}

export function OfficialExamHeader({ motivationalMessage }: OfficialExamHeaderProps) {
  return (
    <div className="space-y-3">
      <Badge variant="destructive" className="uppercase tracking-wide">
        Official Examination
      </Badge>
      <div className="flex items-start gap-3">
        <div className="mt-1 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-destructive">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Official Examination</h1>
          <p className="text-muted-foreground">
            Review all formal rules and confirm readiness before beginning your assessment.
          </p>
          <p className="mt-2 text-sm font-medium text-primary">{motivationalMessage}</p>
        </div>
      </div>
    </div>
  )
}
