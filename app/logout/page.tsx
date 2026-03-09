"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, Home } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const REDIRECT_DELAY_MS = 3000;

export default function LogoutPage() {
  const router = useRouter();

  useEffect(() => {
    let isActive = true;

    const handleLogout = async () => {
      const clerk = (window as unknown as { Clerk?: { signOut: () => Promise<void> } }).Clerk;

      if (clerk?.signOut) {
        try {
          await clerk.signOut();
        } catch {
          // Keep UX stable even if signOut fails transiently.
        }
      }

      setTimeout(() => {
        if (isActive) {
          router.replace("/");
        }
      }, REDIRECT_DELAY_MS);
    };

    void handleLogout();

    return () => {
      isActive = false;
    };
  }, [router]);

  return (
    <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-10">
      <Card className="w-full max-w-lg border-border/70 shadow-sm">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-600">
            <LogOut className="h-6 w-6" />
          </div>
          <CardTitle className="text-3xl tracking-tight">Logging Out</CardTitle>
          <CardDescription className="text-base">
            You are being logged out. Redirecting in 3 seconds.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="rounded-md border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
            Your session is ending safely.
          </div>

          <Button asChild variant="outline" className="w-full">
            <Link href="/">
              <Home className="mr-2 h-4 w-4" />
              Return Home Now
            </Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
