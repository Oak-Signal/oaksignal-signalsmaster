import { AdminDevlogsPanel } from "@/components/admin/admin-devlogs-panel";

export default function AdminDevlogsPage() {
  return (
    <div className="flex flex-col space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Devlogs</h2>
        <p className="text-muted-foreground">
          Create, edit, and delete the entries shown in the public Latest Updates tab.
        </p>
      </div>

      <AdminDevlogsPanel />
    </div>
  );
}
