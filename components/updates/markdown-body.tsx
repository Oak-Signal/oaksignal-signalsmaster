import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { cn } from "@/lib/utils";

interface MarkdownBodyProps {
  body: string;
  className?: string;
}

/**
 * Renders a changelog/roadmap/in-development Markdown `body` as formatted, prose-styled HTML
 * (headings, lists, links, inline code) matching the site's existing typography system, per
 * FR-012. Renders nothing for an empty/whitespace-only body (frontmatter-only entries are valid).
 *
 * Uses `react-markdown` + `remark-gfm` only — no raw HTML passthrough, so entry content can never
 * inject arbitrary markup (XSS-safe by default).
 */
export function MarkdownBody({ body, className }: MarkdownBodyProps) {
  if (!body.trim()) {
    return null;
  }

  return (
    <div className={cn("prose prose-sm prose-neutral max-w-none dark:prose-invert", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
    </div>
  );
}
