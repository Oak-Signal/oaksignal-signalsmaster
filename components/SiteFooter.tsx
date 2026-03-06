"use client";

import Link from "next/link";
import { Anchor, Github, Mail, AlertTriangle } from "lucide-react";

export function SiteFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full bg-muted/30 border-t border-border/40">
      <div className="container mx-auto px-4 md:px-6 py-12 md:py-16">
        
        {/* Disclaimer Banner */}
        <div className="mb-12 rounded-lg border border-red-200 bg-red-50/50 p-4 dark:border-red-900/50 dark:bg-red-900/10">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-500 mt-0.5 shrink-0" />
            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-red-900 dark:text-red-400">Important Disclaimer</h4>
              <p className="text-sm text-red-800/90 dark:text-red-300 leading-relaxed">
                OakSignal is a privately developed software initiative and is not an official system of the Department of National Defence (DND), the Canadian Armed Forces (CAF), or the Cadets and Junior Canadian Rangers (CJCR). While our tools are designed to align with cadet program structures and policies, they are independent third-party solutions.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 md:gap-12">
          
          {/* Column 1: Brand & Mission */}
          <div className="md:col-span-1 space-y-4">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <Anchor className="h-5 w-5 text-primary" />
              </div>
              <span className="text-lg font-bold tracking-tight text-foreground">
                Signals Master
              </span>
            </Link>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Master naval signal flags through interactive practice. Designed for Oakville Sea Cadets to accelerate learning and competition.
            </p>
          </div>

          {/* Column 2: Product */}
          {/* New Pages: 
                How to Contribute (a page outlining how users can contribute to the project, including submitting bug reports, feature requests, or even code contributions)
          */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold tracking-wide uppercase text-foreground">Product</h4>
            <ul className="space-y-2">
              <li>
                <Link href="/faq" className="text-sm text-muted-foreground hover:text-primary transition-colors">FAQ</Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Resources */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold tracking-wide uppercase text-foreground">Resources</h4>
            <ul className="space-y-2">
              <li>
                <Link href="/legal?tab=terms" className="text-sm text-muted-foreground hover:text-primary transition-colors">Terms of Service</Link>
              </li>
              <li>
                <Link href="/legal?tab=privacy" className="text-sm text-muted-foreground hover:text-primary transition-colors">Privacy Policy</Link>
              </li>
            </ul>
          </div>

          {/* Column 4: Contact */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold tracking-wide uppercase text-foreground">Contact</h4>
            <ul className="space-y-2">
              <li>
                <a href="mailto:contact.oaksignal@gmail.com" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors">
                  <Mail className="h-4 w-4" />
                  contact.oaksignal@gmail.com
                </a>
              </li>
            </ul>
            <div className="flex items-center gap-4 mt-4">
              <a href="#" className="text-muted-foreground hover:text-primary transition-colors" aria-label="GitHub">
                <Github className="h-5 w-5" />
                <span className="sr-only">GitHub</span>
              </a>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-8 border-t border-border/40 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex flex-col md:flex-row items-center gap-4 text-center md:text-left">
            <p className="text-sm text-muted-foreground">
              © {currentYear} Signals Master. All rights reserved.
            </p>
            <span className="hidden md:inline text-muted-foreground/30">|</span>
            <p className="text-xs text-muted-foreground font-medium bg-muted/50 px-2 py-1 rounded">
              Not an official DND/CAF/CJCR system. Independently developed.
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            Built with ❤️ for the Sea Cadet Program
          </p>
        </div>
      </div>
    </footer>
  );
}
