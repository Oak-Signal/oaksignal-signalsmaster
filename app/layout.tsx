import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google"; // Ensure these match your actual imports
import "./globals.css";
import ConvexClientProvider from "./ConvexClientProvider";

import { ThemeProvider } from "@/components/theme-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Signals Master | Naval Signal Flags Practice",
    template: "%s | Signals Master"
  },
  description: "Master naval signal flags through interactive practice. Designed for Oakville Sea Cadets to accelerate learning with gamified challenges and ranked competitions.",
  keywords: ["Sea Cadets", "Naval Signals", "Signal Flags", "Oakville", "Learning", "Education", "Navy", "RCSCC Oakville"],
  authors: [{ name: "RCSCC Oakville" }],
  creator: "RCSCC Oakville",
  openGraph: {
    type: "website",
    locale: "en_CA",
    url: "https://signals-master.vercel.app",
    title: "Signals Master | Naval Signal Flags Practice",
    description: "Accelerate your flag recognition skills with gamified learning and competitive challenges.",
    siteName: "Signals Master",
  },
  twitter: {
    card: "summary_large_image",
    title: "Signals Master",
    description: "Master naval signal flags through interactive practice.",
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
      <html lang="en" suppressHydrationWarning>
        <body
          suppressHydrationWarning
          className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen flex flex-col transition-colors duration-300`}
        >
          <ConvexClientProvider>
            <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            {children}
            </ThemeProvider>
          </ConvexClientProvider>
        </body>
      </html>
  );
}