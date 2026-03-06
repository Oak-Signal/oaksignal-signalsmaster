"use client";

import { Package, Anchor, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function OakSignalSection() {
  return (
    <section className="w-full py-16 md:py-24 bg-muted/20 border-t border-border/40" id="about-oaksignal">
      <div className="container px-4 md:px-6 mx-auto">
        
        {/* Header */}
        <div className="flex flex-col items-center text-center space-y-4 mb-16 max-w-3xl mx-auto">
          <Badge variant="outline" className="w-fit px-4 py-1 text-sm border-primary/20 bg-primary/5 text-primary">
            Parent Organization
          </Badge>
          <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">
            About OakSignal
          </h2>
          <p className="text-xl text-muted-foreground leading-relaxed">
            Modern, reliable systems for cadet & youth organizations.
          </p>
          <p className="text-muted-foreground max-w-2xl">
            OakSignal delivers purpose-built applications for training, operations, and engagement. 
            We prioritize clarity, accessibility, and long-term sustainability over fleeting trends.
          </p>
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start mb-16">
          
          {/* Left Column: Mission & Disclaimer */}
          <div className="space-y-8">
            <div className="space-y-4">
              <h3 className="text-2xl font-bold">Our Mission</h3>
              <p className="text-muted-foreground leading-relaxed">
                The administrative burden on cadet instructors and volunteers is significant. 
                Our mission is to reduce that burden through intuitive, reliable software. 
                OakSignal exists to give time back to leaders so they can focus on what matters most: 
                mentoring youth and delivering effective training.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                We operate with a strict multi-tenant architecture, ensuring that each unit&apos;s data 
                is isolated, secure, and accessible only to authorized personnel.
              </p>
            </div>

            {/* Disclaimer Box */}
            <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-6 dark:border-amber-900/50 dark:bg-amber-900/10">
              <div className="flex items-start gap-4">
                <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-500 mt-1 shrink-0" />
                <div className="space-y-2">
                  <h4 className="font-semibold text-amber-900 dark:text-amber-500">Important Disclaimer</h4>
                  <p className="text-sm text-amber-800/90 dark:text-amber-200/90 leading-relaxed">
                    OakSignal is a privately developed software initiative and is not an official system of 
                    the Department of National Defence (DND), the Canadian Armed Forces (CAF), or the 
                    Cadets and Junior Canadian Rangers (CJCR). While our tools are designed to align with 
                    cadet program structures and policies, they are independent third-party solutions.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Platform */}
          <div className="space-y-6">
            <h3 className="text-2xl font-bold">Our Platform</h3>
            
            {/* Signals Master Card */}
            <Card className="border-primary/20 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-md bg-primary/10">
                      <Anchor className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">SignalsMaster</CardTitle>
                      <CardDescription className="text-xs font-medium uppercase tracking-wider mt-1">
                        Training & Operations
                      </CardDescription>
                    </div>
                  </div>
                  <Badge className="bg-primary/10 text-primary hover:bg-primary/20 border-0">Current Application</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Master naval signal flags with three dedicated modes: customizable Practice sessions, Formal Exams for tracked results, and Competitive Leaderboards. A modern, interactive way to build proficiency with instant feedback.
                </p>
              </CardContent>
            </Card>

            {/* Quartermaster Card */}
            <Card className="border-border/60 shadow-xs opacity-90 hover:opacity-100 transition-opacity">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-md bg-muted">
                      <Package className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">Quartermaster</CardTitle>
                      <CardDescription className="text-xs font-medium uppercase tracking-wider mt-1">
                        Supply & Logistics
                      </CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  A modern inventory management system designed specifically for the unique needs of cadet supply stores. 
                  Track uniforms, equipment issuance, and stock levels with precision and ease.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
}
