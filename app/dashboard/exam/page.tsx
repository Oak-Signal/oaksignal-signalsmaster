import { Metadata } from "next"
import { ExamStartClient } from "./exam-start-client"

export const metadata: Metadata = {
  title: "Official Examination | Signals Master",
  description:
    "Review official exam rules and acknowledge readiness before starting or retaking your official assessment.",
}

export default function ExamPage() {
  return <ExamStartClient />
}
