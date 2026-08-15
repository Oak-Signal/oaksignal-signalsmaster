"use client"

import { usePathname } from "next/navigation"
import { AnimatePresence, motion } from "framer-motion"

interface PageTransitionProps {
  children: React.ReactNode
}

/**
 * Wraps route content in a smooth fade/slide transition on navigation.
 * Do NOT use inside focused exam/ranked run shells (FR-025) — timed
 * sessions must not animate/re-render on internal state changes.
 */
export function PageTransition({ children }: PageTransitionProps) {
  const pathname = usePathname()

  return (
    // mode="wait" would hold the new route's content unmounted until the old
    // route's exit animation resolves. With Next.js App Router replacing
    // `children` (Suspense-streamed) on every navigation, that handoff can
    // stall indefinitely, leaving the page blank until a hard refresh. Default
    // (sync) mode animates enter/exit simultaneously instead, so new content
    // always mounts immediately.
    <AnimatePresence initial={false}>
      <motion.div
        key={pathname}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.2, ease: "easeInOut" }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
