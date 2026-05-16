import { Id } from "@/convex/_generated/dataModel"
import { AdminExamReviewClient } from "@/components/admin/admin-exam-review-client"

interface AdminExamReviewPageProps {
	params: Promise<{ examResultId: string }>
}

export default async function AdminExamReviewPage({ params }: AdminExamReviewPageProps) {
	const { examResultId } = await params
	const id = examResultId as Id<"examResults">

	return <AdminExamReviewClient examResultId={id} />
}

export function generateMetadata() {
	return {
		title: "Admin Exam Review | Signals Master",
		description: "Review official exam result integrity and investigation details.",
	}
}
