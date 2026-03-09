import { withAdminApiGuard } from "@/lib/api/admin-handler";

interface AccessCheckResponse {
  success: true;
  data: {
    role: "admin";
    actorUserId: string;
  };
}

export const GET = withAdminApiGuard(async (_req, { adminUser }) => {
  const body: AccessCheckResponse = {
    success: true,
    data: {
      role: "admin",
      actorUserId: adminUser._id,
    },
  };

  return Response.json(body, { status: 200 });
});