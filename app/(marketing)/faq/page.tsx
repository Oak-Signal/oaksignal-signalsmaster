import React from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardDescription, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Shield, Brain, Zap, BookOpen, AlertTriangle } from "lucide-react";

export const metadata = {
  title: "FAQ - Signals Master",
  description: "Frequently asked questions about Signals Master, the naval signal flag learning platform.",
};

export default function FAQPage() {
  return (
    <div className="container mx-auto py-10 px-4 md:px-6 max-w-4xl">
      <div className="space-y-6 text-center mb-12">
        <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl">
          Frequently Asked Questions
        </h1>
        <p className="text-xl text-muted-foreground">
          Everything you need to know about mastering naval signal flags.
        </p>
      </div>

      <div className="grid gap-6">
        {/* General Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 mb-2">
              <Brain className="h-6 w-6 text-primary" />
              <CardTitle className="text-2xl">General Information</CardTitle>
            </div>
            <CardDescription>
              About the project, its goals, and who it&apos;s for.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="what-is">
                <AccordionTrigger>What is Signals Master?</AccordionTrigger>
                <AccordionContent>
                  Signals Master is a mobile-friendly web application designed to help Sea Cadets (initially piloting with Oakville Sea Cadets) learn and master naval signal flags and pennants. It replaces traditional static learning with interactive quizzes, structured exams, and competitive challenges.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="is-official">
                <AccordionTrigger>Is this an official DND/Cadets app?</AccordionTrigger>
                <AccordionContent>
                  <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/10 dark:text-red-200">
                    <strong>No.</strong> OakSignal is a privately developed software initiative and is not an official system of the Department of National Defence (DND), the Canadian Armed Forces (CAF), or the Cadets and Junior Canadian Rangers (CJCR).
                  </div>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="who-is-it-for">
                <AccordionTrigger>Who is this platform for?</AccordionTrigger>
                <AccordionContent>
                  <ul className="list-disc pl-5 space-y-2">
                    <li><strong>Primary Users:</strong> Sea Cadets (ages 12-18) looking to advance their knowledge and prepare for formal evaluations.</li>
                    <li><strong>Instructors:</strong> Officers and senior cadets who need to monitor progress, validate exam results, and ensure fair competition.</li>
                  </ul>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="goals">
                <AccordionTrigger>Why was this created?</AccordionTrigger>
                <AccordionContent>
                  The platform aims to solve the problem of &quot;static learning&quot; where pen-and-paper tests provide no immediate feedback. Our goals are to accelerate learning through repetition, increase engagement via gamification, and provide instructors with better data on cadet readiness.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>

        {/* Learning & Practice */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 mb-2">
              <BookOpen className="h-6 w-6 text-blue-500" />
              <CardTitle className="text-2xl">Learning & Practice</CardTitle>
            </div>
            <CardDescription>
              How to use the practice modules and reference guide.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="practice-modes">
                <AccordionTrigger>What practice modes are available?</AccordionTrigger>
                <AccordionContent>
                  <p className="mb-2">We offer two main ways to practice:</p>
                  <ol className="list-decimal pl-5 space-y-2">
                    <li><strong>Learn the Flag:</strong> You see a flag and must identify its name from multiple choice options.</li>
                    <li><strong>Match Meaning:</strong> You see a meaning (e.g., &quot;Diver down&quot;) and must select the correct flag image.</li>
                  </ol>
                  <p className="mt-2 text-muted-foreground text-xs">Sessions can be customized for 5, 10, 15, or 30+ flags.</p>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="reference-guide">
                <AccordionTrigger>Is there a study guide?</AccordionTrigger>
                <AccordionContent>
                  Yes! The <strong>Interactive Reference Guide</strong> serves as a comprehensive encyclopedia. It is organized by Letters (A-Z), Numbers (0-9), and Pennants. Each entry includes a high-quality SVG image, the official name, meaning, and specific identification tips.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>

        {/* Exams */}
        <Card>
          <CardHeader>
             <div className="flex items-center gap-2 mb-2">
              <Shield className="h-6 w-6 text-green-600" />
              <CardTitle className="text-2xl">Formal Exams</CardTitle>
            </div>
            <CardDescription>
              Details about official assessments and scoring.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="exam-structure">
                <AccordionTrigger>How do formal exams work?</AccordionTrigger>
                <AccordionContent>
                  Formal exams consist of all flags and pennants randomized. Unlike practice, you cannot skip questions. The focus is on accuracy, so there is no time limit.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="passing-score">
                <AccordionTrigger>What is the passing score?</AccordionTrigger>
                <AccordionContent>
                  To pass a formal exam, you must achieve a score of <strong>80% or higher</strong>.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="results-saved">
                <AccordionTrigger>Are exam results saved?</AccordionTrigger>
                <AccordionContent>
                  Yes. Results are <strong>immutable</strong> (cannot be changed) and saved permanently to your user profile. Instructors can review these results to validate your progress for promotions or awards.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>

        {/* Ranked Mode */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 mb-2">
              <Zap className="h-6 w-6 text-yellow-500" />
              <CardTitle className="text-2xl">Ranked Mode & Competition</CardTitle>
            </div>
            <CardDescription>
              Climb the leaderboard and earn your fleet rank.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="ranked-mechanics">
                <AccordionTrigger>How does Ranked Mode differ from exams?</AccordionTrigger>
                <AccordionContent>
                  Ranked Mode is all about <strong>speed</strong> and <strong>accuracy</strong>.
                  <ul className="list-disc pl-5 mt-2 space-y-1">
                    <li>The timer starts immediately.</li>
                    <li>Questions transition instantly (no feedback delays).</li>
                    <li>Your primary score is your total time (fastest wins).</li>
                    <li>Accuracy is a secondary metric—you can&apos;t just spam answers!</li>
                  </ul>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="ranks-badges">
                <AccordionTrigger>What ranks can I earn?</AccordionTrigger>
                <AccordionContent>
                  <p className="mb-4">Your rank is dynamic and based on your leaderboard position:</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2">Position</th>
                          <th className="text-left py-2">Rank Title</th>
                          <th className="text-left py-2">Badge</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b">
                          <td className="py-2">#1</td>
                          <td className="font-bold text-yellow-600">Fleet Master</td>
                          <td>Crown/Star</td>
                        </tr>
                        <tr className="border-b">
                          <td className="py-2">#2</td>
                          <td className="font-medium">Signals Champion</td>
                          <td>Trophy</td>
                        </tr>
                        <tr className="border-b">
                          <td className="py-2">#3</td>
                          <td className="font-medium">Signals Guardian</td>
                          <td>Shield</td>
                        </tr>
                        <tr className="border-b">
                          <td className="py-2">#4</td>
                          <td className="font-medium">Signals Centurion</td>
                          <td>Helmet</td>
                        </tr>
                        <tr className="border-b">
                          <td className="py-2">#5-10</td>
                          <td>Fleet Specialist</td>
                          <td>Anchor</td>
                        </tr>
                        <tr>
                          <td className="py-2">#11+</td>
                          <td>Fleet Practitioner</td>
                          <td>Compass</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="anti-cheat">
                <AccordionTrigger>How do you prevent cheating?</AccordionTrigger>
                <AccordionContent>
                   <div className="flex items-start gap-2 text-muted-foreground text-sm">
                    <AlertTriangle className="h-4 w-4 mt-0.5 text-orange-500" />
                    <span>We take competitive integrity seriously.</span>
                   </div>
                   <ul className="list-disc pl-5 mt-2 space-y-1 text-sm">
                     <li>Timers are validated server-side.</li>
                     <li>There is a minimum answer time threshold (e.g., 500ms) to prevent scripts.</li>
                     <li>Exam flag orders are seeded and verified.</li>
                     <li>Results are cryptographically signed before updating the leaderboard.</li>
                   </ul>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>

      </div>
        <div className="mt-12 text-center">
            <h3 className="text-lg font-semibold mb-2">Still has questions?</h3>
            <p className="text-muted-foreground">Contact your training officer for more details.</p>
        </div>
    </div>
  );
}
