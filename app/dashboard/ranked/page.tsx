import { Metadata } from "next"
import { RankedEntryPageClient } from "@/components/ranked/ranked-entry-page-client"

export const metadata: Metadata = {
  title: "Ranked Mode | Signals Master",
  description:
    "Compete in ranked mode with coherent rules, progression, and secure competitive validation.",
}

export default function RankedPage() {
  return <RankedEntryPageClient />
}
