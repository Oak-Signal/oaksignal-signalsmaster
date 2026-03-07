"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import {
  ExamClientSecurityEventInput,
  ExamClientSecurityEventType,
} from "@/lib/exam-types"

interface UseExamSecurityMonitorOptions {
  enabled?: boolean
  onClientEvent?: (input: ExamClientSecurityEventInput) => void
  fullscreenRecommendation?: boolean
  backNavigationGuard?: boolean
}

interface UseExamSecurityMonitorResult {
  isOffline: boolean
  isWindowFocused: boolean
  isTabVisible: boolean
  isFullscreen: boolean
  isFullscreenSupported: boolean
  isFullscreenRecommended: boolean
  backNavigationBlockedCount: number
  requestFullscreen: () => Promise<boolean>
}

const EVENT_THROTTLE_MS = 800

function getInitialOfflineState(): boolean {
  if (typeof navigator === "undefined") {
    return false
  }
  return !navigator.onLine
}

function getInitialWindowFocusState(): boolean {
  if (typeof document === "undefined") {
    return true
  }
  return document.hasFocus()
}

function getInitialTabVisibleState(): boolean {
  if (typeof document === "undefined") {
    return true
  }
  return document.visibilityState !== "hidden"
}

function getInitialFullscreenState(): boolean {
  if (typeof document === "undefined") {
    return false
  }
  return Boolean(document.fullscreenElement)
}

function isFullscreenApiSupported(): boolean {
  if (typeof document === "undefined") {
    return false
  }
  return typeof document.documentElement.requestFullscreen === "function"
}

export function useExamSecurityMonitor({
  enabled = false,
  onClientEvent,
  fullscreenRecommendation = true,
  backNavigationGuard = true,
}: UseExamSecurityMonitorOptions): UseExamSecurityMonitorResult {
  const [isOffline, setIsOffline] = useState<boolean>(getInitialOfflineState)
  const [isWindowFocused, setIsWindowFocused] = useState<boolean>(getInitialWindowFocusState)
  const [isTabVisible, setIsTabVisible] = useState<boolean>(getInitialTabVisibleState)
  const [isFullscreen, setIsFullscreen] = useState<boolean>(getInitialFullscreenState)
  const [backNavigationBlockedCount, setBackNavigationBlockedCount] = useState(0)

  const onClientEventRef = useRef(onClientEvent)
  const lastEventRef = useRef<Partial<Record<ExamClientSecurityEventType, number>>>({})

  useEffect(() => {
    onClientEventRef.current = onClientEvent
  }, [onClientEvent])

  const emitClientEvent = useCallback(
    (input: ExamClientSecurityEventInput) => {
      if (!enabled) {
        return
      }

      const now = Date.now()
      const lastLoggedAt = lastEventRef.current[input.eventType] ?? 0
      if (now - lastLoggedAt < EVENT_THROTTLE_MS) {
        return
      }

      lastEventRef.current[input.eventType] = now
      onClientEventRef.current?.({
        ...input,
        metadata: {
          ...input.metadata,
          clientTimestamp: now,
        },
      })
    },
    [enabled]
  )

  useEffect(() => {
    if (!enabled || typeof window === "undefined" || typeof document === "undefined") {
      return
    }

    setIsOffline(!navigator.onLine)
    setIsWindowFocused(document.hasFocus())
    setIsTabVisible(document.visibilityState !== "hidden")
    setIsFullscreen(Boolean(document.fullscreenElement))

    const handleOffline = () => {
      setIsOffline(true)
      emitClientEvent({
        eventType: "connection_lost",
        message: "Network connection lost during active exam attempt.",
      })
    }

    const handleOnline = () => {
      setIsOffline(false)
      emitClientEvent({
        eventType: "connection_restored",
        message: "Network connection restored during active exam attempt.",
      })
    }

    const handleWindowBlur = () => {
      setIsWindowFocused(false)
      emitClientEvent({
        eventType: "window_blur",
        message: "Exam window lost focus.",
      })
    }

    const handleWindowFocus = () => {
      setIsWindowFocused(true)
      emitClientEvent({
        eventType: "window_focus",
        message: "Exam window regained focus.",
      })
    }

    const handleVisibilityChange = () => {
      const visible = document.visibilityState !== "hidden"
      setIsTabVisible(visible)

      emitClientEvent({
        eventType: visible ? "tab_visible" : "tab_hidden",
        message: visible
          ? "Exam tab became visible."
          : "Exam tab was hidden during active attempt.",
      })
    }

    const handleFullscreenChange = () => {
      const fullscreenActive = Boolean(document.fullscreenElement)
      setIsFullscreen(fullscreenActive)
      emitClientEvent({
        eventType: fullscreenActive ? "fullscreen_entered" : "fullscreen_exited",
        message: fullscreenActive
          ? "Fullscreen mode entered during exam."
          : "Fullscreen mode exited during exam.",
      })
    }

    window.addEventListener("offline", handleOffline)
    window.addEventListener("online", handleOnline)
    window.addEventListener("blur", handleWindowBlur)
    window.addEventListener("focus", handleWindowFocus)
    document.addEventListener("visibilitychange", handleVisibilityChange)
    document.addEventListener("fullscreenchange", handleFullscreenChange)

    return () => {
      window.removeEventListener("offline", handleOffline)
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("blur", handleWindowBlur)
      window.removeEventListener("focus", handleWindowFocus)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      document.removeEventListener("fullscreenchange", handleFullscreenChange)
    }
  }, [enabled, emitClientEvent])

  useEffect(() => {
    if (!enabled || !backNavigationGuard || typeof window === "undefined") {
      return
    }

    const guardState = {
      examBackGuard: true,
      guardedAt: Date.now(),
    }

    window.history.pushState(guardState, "", window.location.href)

    const handlePopState = () => {
      window.history.pushState(guardState, "", window.location.href)
      setBackNavigationBlockedCount((count) => count + 1)
      emitClientEvent({
        eventType: "back_navigation_blocked",
        message: "Browser back navigation blocked during active exam.",
      })
    }

    window.addEventListener("popstate", handlePopState)
    return () => {
      window.removeEventListener("popstate", handlePopState)
    }
  }, [backNavigationGuard, enabled, emitClientEvent])

  const requestFullscreen = useCallback(async () => {
    if (typeof document === "undefined") {
      return false
    }

    const rootElement = document.documentElement
    if (typeof rootElement.requestFullscreen !== "function") {
      return false
    }

    try {
      await rootElement.requestFullscreen()
      return true
    } catch {
      return false
    }
  }, [])

  const isFullscreenSupported = useMemo(() => isFullscreenApiSupported(), [])
  const isFullscreenRecommended = enabled
    && fullscreenRecommendation
    && isFullscreenSupported
    && !isFullscreen

  return {
    isOffline,
    isWindowFocused,
    isTabVisible,
    isFullscreen,
    isFullscreenSupported,
    isFullscreenRecommended,
    backNavigationBlockedCount,
    requestFullscreen,
  }
}
