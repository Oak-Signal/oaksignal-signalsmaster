// One-time migration source data for the 9 legacy `content/changelog/*.md` entries (US7/T089).
//
// `stage` values below are a genuine, non-uniform best-guess per FR-030 — the legacy frontmatter
// itself only ever contained the literal (and invalid, hyphen-less) string "Pre Alpha", which the
// old zod loader silently coerced to "Pre-Alpha" for every entry via `.catch(...)`. That is not a
// real editorial signal, so stages here are instead assigned from each entry's `version`/date
// progression and feature maturity, per plan.md's Open Items. A human content-owner should review
// and adjust these before T116 deletes the legacy Markdown files.
//
// NOTE: `version` is NOT unique across these entries (five share "0.1.0", three share "0.2.0") —
// it represents a release bucket, not a per-entry ID. `seedDevlogsFromMarkdown` (T090) therefore
// keys idempotency by `title` instead, since all 9 titles are distinct.

export const DEVLOG_SEED_DATA = [
  {
    version: "0.1.0",
    date: "2026-02-11",
    title: "Upgrade Flag Assets to SVGs",
    stage: "Pre-Alpha",
    category: "feature",
    body: `### Changed
- Replaced all 26 alphabet flag images with SVG versions in \`flag-letters\`, ensuring crisp scaling on retina displays and mobile devices.
- Replaced Number and Pennant flag images with SVG equivalents.
- Reduced overall asset file size by migrating from raster (PNG) to vector (SVG) format.

### Fixed
- Reviewed and corrected flag meanings and descriptions to ensure accuracy in the Reference Guide.
- Front-end Reference Guide now renders all flags without blurring on high-DPI screens.

### Internal
- Updated \`letters.ts\`, \`numbers.ts\`, and \`special.ts\` seed files to reference \`.svg\` paths instead of \`.png\`.
- Re-seeded the database via \`npx convex run seed_flags:seedFlags\`, updating live \`imagePath\` fields.
- Verified updated records against the Convex dashboard to confirm successful migration.`,
  },
  {
    version: "0.1.0",
    date: "2026-02-12",
    title: "Practice Session Pause and Exit Controls",
    stage: "Pre-Alpha",
    category: "feature",
    body: `### Added
- Pause button and Escape-key shortcut during practice sessions.
- Confirmation modal on exit with "Save and Exit", "Exit without Saving", and "Cancel" options.
- Session timer that pauses alongside the session.
- Sessions marked as resumable in the database, returning to the practice hub after saving.`,
  },
  {
    version: "0.1.0",
    date: "2026-02-12",
    title: "Results and Analytics Dashboard",
    stage: "Pre-Alpha",
    category: "feature",
    body: `### Added
- Immediate results page showing score, completion time, mode, and question-by-question breakdown with correct/incorrect indicators.
- "Review Mistakes" and "Practice Again" flows for post-session actions.
- Analytics dashboard with Recharts visualizations: performance over time, success rate by mode and flag category, and practice frequency.
- Personal records tracking (best score, longest streak) and mastery indicators for consistently correct flags.
- Convex queries for session history with date-range filtering and server-side aggregate statistics.`,
  },
  {
    version: "0.1.0",
    date: "2026-02-13",
    title: "Auto-Save and Resume for Practice Sessions",
    stage: "Pre-Alpha",
    category: "feature",
    body: `### Added
- Automatic Convex-backed save of session state (question index, correct count, answered questions) after each question.
- Resume option on practice hub for in-progress sessions, restoring exact question order and prior answers.
- Session timeout after 7 days of inactivity, marking sessions as abandoned.
- Warning modal when starting a new session while an incomplete one exists.

### Fixed
- Progress bar now accurately reflects saved session progress.`,
  },
  {
    version: "0.1.0",
    date: "2026-03-05",
    title: "Exam Start and Rules Acknowledgment Page",
    stage: "Alpha",
    category: "feature",
    body: `### Added
- Official Examination start page displaying rules: question count, pass threshold (80%), single-attempt policy, and no pause/resume notice.
- Cadet's current practice statistics shown alongside prerequisite requirements.
- Dual acknowledgment checkboxes required before enabling "Start Exam" button.
- Confirmation modal warning that the exam cannot be paused once started.
- Exam start time and IP address logged for security.`,
  },
  {
    version: "0.2.0",
    date: "2026-03-06",
    title: "Secure Exam Interface with Progress Tracking",
    stage: "Alpha",
    category: "feature",
    body: `### Added
- Distraction-free exam interface with forward-only navigation (no previous-question access).
- Progress bar and question counter (e.g., "Question 12 of 50") reflecting exam length.
- Selectable multiple-choice answer cards with submit-to-advance flow and no post-submission edits.
- Elapsed time display and immediate auto-save of answers to the server.
- Session token validation on each answer submission.

### Security
- Disabled browser back-button functionality and non-answer keyboard shortcuts during the exam.`,
  },
  {
    version: "0.2.0",
    date: "2026-03-07",
    title: "Randomized Exam Question Generation",
    stage: "Alpha",
    category: "feature",
    body: `### Added
- Convex mutation generating a full exam covering all flags in the database, with server-side randomized question order.
- Shuffled multiple-choice options per question, with no duplicate flags in a single exam.
- Exam attempt records storing userId, startTime, totalQuestions, and attempt number.
- Exam seed stored for reproducibility and audit purposes.

### Security
- Correct answers withheld from the client; all answer validation handled server-side.`,
  },
  {
    version: "0.2.0",
    date: "2026-03-08",
    title: "Server-Side Answer Validation and Scoring",
    stage: "Alpha",
    category: "feature",
    body: `### Added
- Convex mutations validating all exam answers server-side, with no correct-answer exposure to the client.
- Server-calculated running score and final pass/fail determination (80% threshold), withheld from client until exam completion.
- Duplicate-submission detection and exam session/attempt ID verification on each answer.
- Detailed post-exam statistics broken down by category and mode.

### Security
- Validation failures logged for security review; rate limiting applied to answer submissions.`,
  },
  {
    version: "0.3.0",
    date: "2026-03-23",
    title: "Admin Review Dashboard and Exam Management",
    stage: "Closed Beta",
    category: "feature",
    body: `### Added

Secure Admin Portal with the following features:

- Admin Access Control
- Exam Overview Statistic Dashboard
- Exam Activity Timeline Visualization
- Exam List & Filtering - Recent Exam List with Pagination
- Detailed Review/Analytics - Exam Invalidation & Admin Actions
- Detailed Review/Analytics - Integrity Monitoring & Suspicious Attempt Detection
- Results Review & Certificate Access

Exam Improvements:

- Exam Integrity and Anti-cheating Measures
- Post-Exam Session Results Review & Certificate Access`,
  },
] as const;
