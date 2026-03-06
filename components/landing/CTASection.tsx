"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function CTASection() {
  return (
    <section className="w-full py-20 md:py-32 relative overflow-hidden">
      {/* Background Gradient with Overlay */}
      <div className="absolute inset-0 bg-linear-to-br from-primary to-blue-700 z-0" />
      
      {/* Decorative Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 opacity-10 pointer-events-none">
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-white blur-3xl" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 rounded-full bg-white blur-3xl" />
      </div>

      <div className="container px-4 md:px-6 mx-auto relative z-10">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="flex flex-col items-center justify-center text-center space-y-8 max-w-3xl mx-auto"
        >
          <div className="space-y-4">
            <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl text-primary-foreground">
              Ready to Become a Signals Master?
            </h2>
            <p className="mx-auto max-w-175 text-primary-foreground/90 text-xl md:text-2xl font-light leading-relaxed">
              Join and start mastering naval signal flags today.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row w-full sm:w-auto gap-4 md:gap-6">
            <Button 
              size="lg" 
              variant="secondary" 
              className="h-14 px-8 text-lg font-semibold shadow-lg group"
              asChild
            >
              <Link href="/login">
                Login to Practice
                <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Link>
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
