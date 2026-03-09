import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function AdminExamManagementPage() {
  return (
    <div className="flex flex-col space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Exam Management</h2>
        <p className="text-muted-foreground">
          Administrative controls for official exam configuration will be implemented here.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Coming Soon</CardTitle>
          <CardDescription>
            This placeholder route keeps admin navigation functional while exam management features are delivered in follow-up stories.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  )
}
