"use client";

import { motion, useInView, useSpring, useTransform } from "framer-motion";
import { Anchor, Award, Flag, Layers } from "lucide-react";
import { useEffect, useRef } from "react";

// --- Components ---

function Counter({ value, suffix = "" }: { value: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-50px" });
  
  // Use a spring for smoother, more natural counting
  const springValue = useSpring(0, {
    stiffness: 50,
    damping: 20,
    duration: 1.5
  });

  const displayValue = useTransform(springValue, (current) => 
    Math.round(current).toString() + suffix
  );

  useEffect(() => {
    if (inView) {
      springValue.set(value);
    }
  }, [inView, value, springValue]);

  return <motion.span ref={ref}>{displayValue}</motion.span>;
}

export function TrustSection() {
  return (
    <section className="w-full flex flex-col">
      {/* 1. Built For Subsection */}
      <div className="w-full py-16 md:py-24 bg-background border-b border-border/40">
        <div className="container px-4 md:px-6 mx-auto">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="flex flex-col items-center justify-center text-center max-w-4xl mx-auto"
          >
            {/* Logo/Badge Placeholder */}
            <div className="mb-8 flex h-28 w-28 items-center justify-center rounded-full bg-primary/10 shadow-inner">
              <Anchor className="h-14 w-14 text-primary" />
            </div>

            <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl text-foreground mb-4">
              Designed for Oakville Sea Cadets
            </h2>
            
            <p className="text-xl text-muted-foreground leading-relaxed max-w-2xl">
              Created in partnership with instructors to address real learning challenges and prepare cadets for success.
            </p>

            {/* Optional Testimonial Placeholder */}
            <div className="mt-10 p-6 bg-card rounded-xl border shadow-sm max-w-2xl w-full">
              <p className="italic text-muted-foreground mb-4">
                &quot;&quot;
              </p>
              <div className="flex items-center justify-center gap-3">
                <div className="h-2 w-2 rounded-full bg-primary"></div>
                <span className="font-semibold text-sm text-foreground">Training Officer</span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* 2. Stats Subsection */}
      <div className="w-full py-16 md:py-20 bg-muted/40">
        <div className="container px-4 md:px-6 mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
            
            {/* Stat 1 */}
            <div className="flex flex-col items-center justify-center text-center space-y-2">
              <div className="p-3 bg-background rounded-full shadow-sm mb-2">
                <Flag className="h-6 w-6 text-primary" />
              </div>
              <div className="text-4xl md:text-5xl font-bold text-foreground tracking-tight">
                <Counter value={40} suffix="+" />
              </div>
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                Signal Flags
              </p>
            </div>

            {/* Stat 2 */}
            <div className="flex flex-col items-center justify-center text-center space-y-2">
              <div className="p-3 bg-background rounded-full shadow-sm mb-2">
                <Layers className="h-6 w-6 text-primary" />
              </div>
              <div className="text-4xl md:text-5xl font-bold text-foreground tracking-tight">
                <Counter value={3} />
              </div>
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                Learning Modes
              </p>
            </div>

            {/* Stat 3 */}
            <div className="flex flex-col items-center justify-center text-center space-y-2">
              <div className="p-3 bg-background rounded-full shadow-sm mb-2">
                <Award className="h-6 w-6 text-primary" />
              </div>
              <div className="text-4xl md:text-5xl font-bold text-foreground tracking-tight">
                <Counter value={100} suffix="%" />
              </div>
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                Free for Cadets
              </p>
            </div>

          </div>
        </div>
      </div>
    </section>
  );
}
