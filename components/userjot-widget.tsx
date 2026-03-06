"use client"

import { useUser } from "@clerk/nextjs"
import { useEffect, useRef } from "react"

type UserjotTheme = "auto" | "light" | "dark"
type UserjotPosition = "left" | "right"
type UserjotTrigger = "default" | "custom"

interface UserjotInitOptions {
  widget: boolean
  position: UserjotPosition
  theme: UserjotTheme
  trigger?: UserjotTrigger
}

interface UserjotIdentifyPayload {
  id: string
  email?: string
  firstName?: string
  lastName?: string
  avatar?: string
}

interface UserjotApi {
  init: (projectId: string, options: UserjotInitOptions) => void
  identify: (payload: UserjotIdentifyPayload) => void
  showWidget: () => void
}

declare global {
  interface Window {
    $ujq?: unknown[][]
    uj?: UserjotApi
  }
}

const USERJOT_PROJECT_ID =
  process.env.NEXT_PUBLIC_USERJOT_PROJECT_ID ?? "cmmf5byyu06n20ipzyt5l50bk"

const USERJOT_OPTIONS: UserjotInitOptions = {
  widget: true,
  position: "right",
  theme: "auto",
  trigger: "custom",
}

export function UserjotWidget() {
  const { isLoaded, isSignedIn, user } = useUser()
  const hasInitialized = useRef(false)
  const identifiedUserId = useRef<string | null>(null)

  useEffect(() => {
    if (hasInitialized.current || !USERJOT_PROJECT_ID) return

    window.$ujq = window.$ujq || []
    window.uj =
      window.uj ||
      (new Proxy(
        {},
        {
          get: (_, prop) => (...args: unknown[]) => {
            window.$ujq?.push([prop, ...args])
          },
        }
      ) as UserjotApi)

    const existingScript = document.querySelector(
      'script[data-userjot-sdk="true"]'
    )

    if (!existingScript) {
      const script = document.createElement("script")
      script.src = "https://cdn.userjot.com/sdk/v2/uj.js"
      script.type = "module"
      script.async = true
      script.dataset.userjotSdk = "true"
      document.head.appendChild(script)
    }

    window.uj.init(USERJOT_PROJECT_ID, USERJOT_OPTIONS)
    hasInitialized.current = true
  }, [])

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user || !window.uj) return
    if (identifiedUserId.current === user.id) return

    window.uj.identify({
      id: user.id,
      email: user.primaryEmailAddress?.emailAddress,
      firstName: user.firstName ?? undefined,
      lastName: user.lastName ?? undefined,
      avatar: user.imageUrl ?? undefined,
    })

    identifiedUserId.current = user.id
  }, [isLoaded, isSignedIn, user])

  return null
}
