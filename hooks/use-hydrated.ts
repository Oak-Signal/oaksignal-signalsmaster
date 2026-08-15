import { useSyncExternalStore } from "react"

const emptySubscribe = () => () => {}

/**
 * Returns false during SSR and the initial client hydration pass, then true
 * afterwards. Use to gate branches that depend on client-only/async data
 * (e.g. a Convex `useQuery` result) so the first client render matches the
 * server markup exactly and avoids hydration mismatches.
 */
export function useHydrated() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  )
}
