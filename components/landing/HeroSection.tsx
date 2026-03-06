"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { FlagAnimation } from "./FlagAnimation";

export function HeroSection() {
  return (
    <section className="relative w-full overflow-hidden bg-gradient-to-b from-background to-secondary/20">
      <div className="container px-4 md:px-6 py-12 md:py-24 lg:py-32 mx-auto">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-8 items-center">
          <div className="flex flex-col justify-center space-y-8">
            <div className="space-y-4">
              <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl md:text-6xl lg:text-7xl xl:text-7xl">
                Master Naval Signal Flags Through <span className="text-primary">Interactive Practice</span>
              </h1>
              <p className="max-w-[600px] text-lg text-muted-foreground md:text-xl leading-relaxed">
                Designed for Oakville Sea Cadets to accelerate flag recognition through gamified learning and competitive challenges.
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4">
              <Button asChild size="lg" className="h-12 px-8 text-base shadow-lg hover:shadow-xl transition-all">
                <Link href="/login">
                  Enter <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="h-12 px-8 text-base">
                <Link href="#how-it-works">
                  See How It Works
                </Link>
              </Button>
            </div>

            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <span>Formal Exams</span>
              </div>
              <div className="h-1 w-1 rounded-full bg-border" />
              <div>Ranked Competition</div>
              <div className="h-1 w-1 rounded-full bg-border" />
              <div>Interactive Reference</div>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[600px] lg:max-w-none">
            {/* Visual background decoration */}
            <div className="absolute -top-12 -right-12 w-64 h-64 bg-primary/10 rounded-full blur-3xl opacity-50" />
            <div className="absolute -bottom-12 -left-12 w-64 h-64 bg-secondary/20 rounded-full blur-3xl opacity-50" />
            
            <FlagAnimation />
          </div>
        </div>
      </div>
    </section>
  );
}
