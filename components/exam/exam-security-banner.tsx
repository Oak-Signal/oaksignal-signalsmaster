"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface ExamSecurityBannerProps {
  isOffline: boolean
  isWindowFocused: boolean
  isTabVisible: boolean
  isFullscreenRecommended: boolean
  backNavigationBlockedCount: number
  restrictedShortcutBlockedCount: number
  onRequestFullscreen?: () => void
}

export function ExamSecurityBanner({
  isOffline,
  isWindowFocused,
  isTabVisible,
  isFullscreenRecommended,
  backNavigationBlockedCount,
  restrictedShortcutBlockedCount,
  onRequestFullscreen,
}: ExamSecurityBannerProps) {
  const hasAlertState = isOffline || !isWindowFocused || !isTabVisible

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "rounded-lg border p-4",
        hasAlertState
          ? "border-destructive/40 bg-destructive/5"
          : "border-border bg-muted/25"
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={hasAlertState ? "destructive" : "secondary"} className="uppercase tracking-wide">
          Security Monitoring Active
        </Badge>
        <Badge variant="outline">Keyboard: 1-4 Answer Selection</Badge>
        {backNavigationBlockedCount > 0 && (
          <Badge variant="outline">Back blocked {backNavigationBlockedCount}</Badge>
        )}
        {restrictedShortcutBlockedCount > 0 && (
          <Badge variant="outline">Shortcuts blocked {restrictedShortcutBlockedCount}</Badge>
        )}
      </div>

      <div className="mt-3 space-y-1 text-sm">
        {isOffline && (
          <p className="text-destructive">
            Connection lost. Reconnect immediately to continue your official exam.
          </p>
        )}
        {!isTabVisible && (
          <p className="text-destructive">This exam tab is hidden. Return to this tab now.</p>
        )}
        {!isWindowFocused && isTabVisible && (
          <p className="text-destructive">Exam window focus was lost. Keep this window active.</p>
        )}

        {isFullscreenRecommended && (
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-muted-foreground">
              Fullscreen mode is recommended for a focused exam environment.
            </p>
            {onRequestFullscreen && (
              <Button type="button" size="sm" variant="outline" onClick={onRequestFullscreen}>
                Enable Fullscreen
              </Button>
            )}
          </div>
        )}

        {!hasAlertState && !isFullscreenRecommended && (
          <p className="text-muted-foreground">
            Focus is being monitored. Use keys 1-4 to select answers.
          </p>
        )}
      </div>
    </div>
  )
}
