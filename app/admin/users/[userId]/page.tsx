import { AdminUserProfilePageClient } from "@/components/admin/admin-user-profile-page-client";

interface AdminUserProfilePageProps {
  params: Promise<{
    userId: string;
  }>;
}

export default async function AdminUserProfilePage({ params }: AdminUserProfilePageProps) {
  const { userId } = await params;

  return <AdminUserProfilePageClient userId={userId} />;
}
