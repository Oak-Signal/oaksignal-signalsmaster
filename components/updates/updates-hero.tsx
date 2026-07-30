import { Rocket } from "lucide-react";

/**
 * Hero section for `/updates` — communicates the page's purpose before any tab content, per
 * FR-008. Rendered as a Server Component (no client interactivity needed).
 */
export function UpdatesHero() {
  return (
    <div className="mb-10 space-y-4 text-center md:mb-14">
      <div
        className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary"
        aria-hidden="true"
      >
        <Rocket className="h-6 w-6" />
      </div>
      <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl">
        Development Updates &amp; Roadmap
      </h1>
      <p className="mx-auto max-w-2xl text-lg text-muted-foreground md:text-xl">
        See what&apos;s shipped, what we&apos;re actively building right now, and what&apos;s
        planned next for Signals Master.
      </p>
    </div>
  );
}
