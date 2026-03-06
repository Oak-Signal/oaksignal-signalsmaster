import Link from "next/link"

import { Button } from "@/components/ui/button"

export function NotReadyActions() {
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <Button asChild variant="outline">
        <Link href="/dashboard/practice">Not Ready? Go to Practice</Link>
      </Button>
      <Button asChild variant="ghost">
        <Link href="/dashboard/analytics">Review Analytics</Link>
      </Button>
    </div>
  )
}
