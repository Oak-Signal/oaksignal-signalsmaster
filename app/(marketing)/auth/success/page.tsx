import { AuthSuccessClient } from "@/components/auth/auth-success-client";

// Per-user post-login screen: render per request so it is never prerendered at build time,
// when no Convex client is available (e.g. CI builds without NEXT_PUBLIC_CONVEX_URL).
export const dynamic = "force-dynamic";

export default function AuthSuccessPage() {
  return <AuthSuccessClient />;
}
