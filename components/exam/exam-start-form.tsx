"use client"

import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface ExamStartFormProps {
  rulesAcknowledged: boolean
  readinessAcknowledged: boolean
  stableInternetConfirmed: boolean
  onRulesAcknowledgedChange: (checked: boolean) => void
  onReadinessAcknowledgedChange: (checked: boolean) => void
  onStableInternetConfirmedChange: (checked: boolean) => void
  onStartClick: () => void
  disabled: boolean
  isSubmitting: boolean
  minRulesViewRemainingMs: number
}

export function ExamStartForm({
  rulesAcknowledged,
  readinessAcknowledged,
  stableInternetConfirmed,
  onRulesAcknowledgedChange,
  onReadinessAcknowledgedChange,
  onStableInternetConfirmedChange,
  onStartClick,
  disabled,
  isSubmitting,
  minRulesViewRemainingMs,
}: ExamStartFormProps) {
  const remainingSeconds = Math.ceil(minRulesViewRemainingMs / 1000)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Acknowledgment & Start</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-3 rounded-md border p-3">
          <Checkbox
            id="rules-acknowledged"
            checked={rulesAcknowledged}
            onCheckedChange={(checked) => onRulesAcknowledgedChange(checked === true)}
            aria-label="I have read and understand the examination rules"
          />
          <Label htmlFor="rules-acknowledged" className="cursor-pointer leading-5">
            I have read and understand the examination rules.
          </Label>
        </div>

        <div className="flex items-start gap-3 rounded-md border p-3">
          <Checkbox
            id="ready-acknowledged"
            checked={readinessAcknowledged}
            onCheckedChange={(checked) => onReadinessAcknowledgedChange(checked === true)}
            aria-label="I am ready to begin my official assessment"
          />
          <Label htmlFor="ready-acknowledged" className="cursor-pointer leading-5">
            I am ready to begin my official assessment.
          </Label>
        </div>

        <div className="flex items-start gap-3 rounded-md border p-3">
          <Checkbox
            id="stable-internet-confirmed"
            checked={stableInternetConfirmed}
            onCheckedChange={(checked) => onStableInternetConfirmedChange(checked === true)}
            aria-label="I confirm my internet connection is stable"
          />
          <Label htmlFor="stable-internet-confirmed" className="cursor-pointer leading-5">
            I confirm my internet connection is stable for this exam session.
          </Label>
        </div>

        {minRulesViewRemainingMs > 0 && (
          <p className="text-sm text-muted-foreground">
            Please continue reviewing the rules for at least {remainingSeconds} more second
            {remainingSeconds === 1 ? "" : "s"}.
          </p>
        )}

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            size="lg"
            disabled={disabled || isSubmitting}
            onClick={onStartClick}
            className="sm:min-w-48"
            aria-label="Start official exam"
          >
            {isSubmitting ? "Starting Exam..." : "Start Exam"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
