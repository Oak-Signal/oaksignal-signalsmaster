import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server"; // Need this for redirects

const isPublicRoute = createRouteMatcher([
  "/", 
  "/login(.*)", 
  "/sign-up(.*)", 
  "/faq(.*)", 
  "/legal(.*)",
  "/api/webhooks(.*)"
]);

// Define routes that logged-in users shouldn't visit
const isAuthRoute = createRouteMatcher([
  "/login(.*)",
  "/sign-up(.*)"
]);

export default clerkMiddleware(async (auth, request) => {
  const { userId } = await auth();

  // 1. If user is logged in and trying to access login/signup, redirect to dashboard
  if (userId && isAuthRoute(request)) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // 2. Protect private routes (like dashboard)
  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};