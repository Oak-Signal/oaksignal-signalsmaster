"use client"

import { useEffect, useRef, useState } from "react"

interface ExamRestrictedShortcutDetails {
  key: string
  code: string
  ctrlKey: boolean
  altKey: boolean
  metaKey: boolean
  shiftKey: boolean
}

interface UseExamKeyboardLockdownOptions {
  enabled?: boolean
  onRestrictedShortcutBlocked?: (details: ExamRestrictedShortcutDetails) => void
}

interface UseExamKeyboardLockdownResult {
  blockedShortcutCount: number
}

const BLOCKED_META_CTRL_KEYS = new Set(["r", "R", "w", "W", "l", "L", "n", "N", "t", "T", "p", "P"])

function isEditableTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) {
    return false
  }

  return (
    target.tagName === "INPUT"
    || target.tagName === "TEXTAREA"
    || target.tagName === "SELECT"
    || target.isContentEditable
  )
}

function mapKeyToOptionIndex(key: string): number | null {
  const keyMap: Record<string, number> = {
    "1": 0,
    "2": 1,
    "3": 2,
    "4": 3,
  }
  return keyMap[key] ?? null
}

function selectExamOptionByIndex(optionIndex: number): boolean {
  const radioGroup = document.querySelector<HTMLElement>(
    '[role="radiogroup"][aria-label="Exam answer options"]'
  )
  if (!radioGroup) {
    return false
  }

  const options = Array.from(
    radioGroup.querySelectorAll<HTMLButtonElement>('button[role="radio"]')
  )

  const targetOption = options[optionIndex]
  if (!targetOption || targetOption.disabled) {
    return false
  }

  targetOption.focus({ preventScroll: true })
  targetOption.click()
  return true
}

function isRestrictedShortcut(event: KeyboardEvent): boolean {
  if (event.key === "F5" || event.key === "BrowserBack") {
    return true
  }

  if (event.key === "Backspace") {
    return true
  }

  if (event.altKey && event.key === "ArrowLeft") {
    return true
  }

  if ((event.ctrlKey || event.metaKey) && BLOCKED_META_CTRL_KEYS.has(event.key)) {
    return true
  }

  return false
}

export function useExamKeyboardLockdown({
  enabled = false,
  onRestrictedShortcutBlocked,
}: UseExamKeyboardLockdownOptions): UseExamKeyboardLockdownResult {
  const [blockedShortcutCount, setBlockedShortcutCount] = useState(0)

  const blockedCallbackRef = useRef(onRestrictedShortcutBlocked)
  useEffect(() => {
    blockedCallbackRef.current = onRestrictedShortcutBlocked
  }, [onRestrictedShortcutBlocked])

  useEffect(() => {
    if (!enabled || typeof window === "undefined") {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) {
        return
      }

      const optionIndex = mapKeyToOptionIndex(event.key)
      if (optionIndex !== null) {
        event.preventDefault()
        selectExamOptionByIndex(optionIndex)
        return
      }

      if (!isRestrictedShortcut(event)) {
        return
      }

      event.preventDefault()
      event.stopPropagation()

      setBlockedShortcutCount((count) => count + 1)
      blockedCallbackRef.current?.({
        key: event.key,
        code: event.code,
        ctrlKey: event.ctrlKey,
        altKey: event.altKey,
        metaKey: event.metaKey,
        shiftKey: event.shiftKey,
      })
    }

    window.addEventListener("keydown", handleKeyDown, true)
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true)
    }
  }, [enabled])

  return {
    blockedShortcutCount,
  }
}
