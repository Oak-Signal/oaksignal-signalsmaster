# Session Statistics Reference

> **Source of truth** for every statistic derived from practice sessions (`practiceSessions`
> table, `learn` and `match` modes). If you change a formula in code, change it here in the same
> pull request. Canonical implementations live in `convex/lib/session_stats.ts`; each function's
> JSDoc links back to its section below via `@see docs/session-statistics.md#<anchor>`.
>
> Feature: `specs/004-session-stats-audit` (local spec). Ranked runs and formal exams are **out of
> scope** and documented elsewhere.

## Contents

- [Principles](#principles)
- [Constants](#constants)
- [Raw Fields](#raw-fields)
- Per-session stats: [Session Correct Count](#session-correct-count) ·
  [Session Total Questions](#session-total-questions) ·
  [Session Score Percent](#session-score-percent) · [Response Time](#response-time) ·
  [Session Active Time](#session-active-time)
- Aggregate stats: [Sessions Completed](#sessions-completed) · [Average Score](#average-score) ·
  [Best Score](#best-score) · [Worst Score](#worst-score) · [Accuracy](#accuracy) ·
  [Total Time Practiced](#total-time-practiced) · [Average Session Time](#average-session-time) ·
  [Average Response Time](#average-response-time) · [Current Day Streak](#current-day-streak) ·
  [Longest Day Streak](#longest-day-streak) · [Flags Practiced](#flags-practiced) ·
  [Flags Mastered](#flags-mastered) · [Miss Rate](#miss-rate) ·
  [Weekly Frequency](#weekly-frequency) · [Last Practiced](#last-practiced)
- In-session stats: [In-session Accuracy](#in-session-accuracy) ·
  [In-session Answer Streak](#in-session-answer-streak)
- [Implementation Status](#implementation-status)

---

## Principles

1. **Derive, don't trust.** Every number is derived from raw answer data
   (`questions[].userAnswer` vs `questions[].correctAnswer`, server timestamps). Stored `score`,
   `correctCount`, and `activeTimeMs` are caches only and are never read for display when raw data
   exists.
2. **Server-authoritative.** All formulas run in Convex. UI components render returned values and
   never re-derive them. No client-supplied scores or timings are accepted.
3. **Correct by construction, not by clamping.** Percentages are within 0–100 because of how they
   are computed. A value outside that range is a data bug for the audit to report, not something to
   hide.
4. **Round once, at the end.** Intermediate values are kept unrounded; each stat rounds exactly
   once, as specified below.
5. **Completed sessions only.** Unless stated otherwise, aggregate stats include only sessions with
   `status = "completed"`. `active` and `abandoned` sessions are excluded from every score, accuracy,
   time, streak, and mastery stat.
6. **Date range.** Aggregates on the analytics page honour the `7d` / `30d` / `all` filter using
   `completedAt >= now − N days`. Streaks always use **all** history.

## Constants

| Name | Value | Meaning |
|------|-------|---------|
| `STATS_TIME_ZONE` | `"America/Toronto"` | Time zone for calendar-day and week boundaries (Oakville unit). No per-user time zone exists. |
| `RESPONSE_TIME_CAP_MS` | `60_000` | Maximum time a single answer can contribute to time stats. Stops idle or resumed sessions from inflating totals. |

## Raw Fields

| Field | Written by | Meaning |
|-------|-----------|---------|
| `questions[].userAnswer` | `submitAnswer` | Selected option id, `null` until answered. |
| `questions[].correctAnswer` | `createPracticeSession` | Correct option id. |
| `questions[].answeredAt` | `submitAnswer` (server `Date.now()`) | When the answer was accepted. Missing on legacy sessions. |
| `startedAt` | `createPracticeSession` | Session creation time. |
| `completedAt` | `submitAnswer` on the last answer | Completion time. Also set on abandon (abandoned rows are excluded). |
| `timeTaken` | `submitAnswer` on the last answer | Wall-clock `completedAt − startedAt`. Includes idle/resume time. **Not used for practice-time stats.** |
| `score` | `submitAnswer` | Cache of [Session Score Percent](#session-score-percent). |
| `correctCount` | `submitAnswer` | Cache of [Session Correct Count](#session-correct-count). |
| `activeTimeMs` | `submitAnswer` on completion | Cache of [Session Active Time](#session-active-time). Missing on legacy sessions. |
| `sessionLength` | `createPracticeSession` | Requested question count. Used only for legacy rows without `questions`. |

---

## Per-session Stats

### Session Correct Count

- **Function**: `deriveSessionCorrectCount(session)`
- **Surfaces**: "X of Y correct" on Results, Recent Activity, and admin session history.
- **Producers**: `getSessionResults`, `getRecentSessions`; input to most aggregates.
- **Formula**: number of questions where `userAnswer === correctAnswer`.
- **Legacy fallback** (no `questions` array): stored `correctCount`, clamped to
  `[0, sessionLength]`.
- **Empty value**: `0`.

### Session Total Questions

- **Function**: `deriveSessionTotalQuestions(session)`
- **Formula**: `questions.length`; legacy fallback `sessionLength`.
- **Note**: Questions whose flag record was deleted still count. The results list shows them with
  an "Unknown flag" placeholder.

### Session Score Percent

- **Function**: `deriveSessionScorePercent(session)`
- **Surfaces**: Results hero, Recent Activity, Performance Trend chart, admin session history.
- **Producers**: `getSessionResults`, `getRecentSessions`, `getPerformanceTrend`.
- **Formula**: `round(correct / total × 100)` using [Session Correct Count](#session-correct-count)
  and [Session Total Questions](#session-total-questions).
- **Rounding**: `Math.round` (half up), once.
- **Empty value**: `0` when `total = 0`.
- **Edge cases**: A stored `score` that differs (e.g. legacy `800`) is ignored for display and
  reported by the audit as `SCORE_MISMATCH` / `SCORE_OUT_OF_RANGE`.
- **History**: The original "800%" bug computed `score / total × 100` while `score` was already a
  percent (`80 / 10 × 100`).

### Response Time

- **Function**: `computeQuestionResponseTimes(session)`
- **Formula**: for answered question `i` in answer order,
  `min(answeredAt[i] − (answeredAt[i−1] ?? startedAt), RESPONSE_TIME_CAP_MS)`.
- **Inclusion**: only sessions with **complete timing**, meaning every answered question has
  `answeredAt` (`hasCompleteTiming`). Legacy sessions and sessions that were partly answered
  before timestamps existed yield an empty list.
- **Edge cases**: A negative delta (clock anomaly) is treated as `0`.

### Session Active Time

- **Function**: `computeSessionActiveTimeMs(session)`
- **Surfaces**: Results duration badge, Recent Activity duration, input to time aggregates.
- **Formula**: sum of [Response Time](#response-time) values.
- **Legacy fallback** (no complete timing data): `min(timeTaken, total × RESPONSE_TIME_CAP_MS)`;
  `0` if `timeTaken` is missing.
- **Rounding**: none (integer milliseconds).

---

## Aggregate Stats

### Sessions Completed

- **Surfaces**: Dashboard "Total Sessions", Analytics "Total Sessions", Practice page "Completed
  Sessions", admin profile "Completed Practice Sessions".
- **Producers**: `getAnalyticsSummary`, `getUserPracticeStats`, `getUserProfile` (admin).
- **Formula**: count of the user's sessions with `status = "completed"` (within range on
  analytics).
- **Note**: Any count of started or abandoned sessions must be labelled as such. These counts are
  per-user, never global.
- **Empty value**: `0`.

### Average Score

- **Function**: `computeAverageScore(percents)`
- **Surfaces**: Dashboard, Analytics, Practice page, admin profile.
- **Formula**: arithmetic mean of [Session Score Percent](#session-score-percent) over completed
  sessions in range. Each session is weighted equally, whatever its length.
- **Rounding**: `Math.round` once, on the mean of the already-rounded per-session percents.
- **Empty value**: `0`. The UI shows "N/A" when there are no completed sessions.
- **Not the same as [Accuracy](#accuracy)**: Average Score weights sessions equally; Accuracy
  weights questions equally. A 5-question 100% session and a 30-question 50% session average to
  75%, but their accuracy is 57%.

### Best Score

- **Function**: `computeBestScore(percents)`
- **Surfaces**: Dashboard, Analytics.
- **Formula**: `max` of session percents over completed sessions in range.
- **Empty value**: `0`.

### Worst Score

- **Function**: `computeWorstScore(percents)`
- **Surfaces**: none at present. Returned by `getAnalyticsSummary` as `worstScore`.
- **Formula**: `min` of session percents over completed sessions in range.
- **Empty value**: `0`.

### Accuracy

- **Functions**: `computeAccuracy(correct, answered)`; answered count per session from
  `deriveSessionAnsweredCount(session)` (legacy rows count as fully answered)
- **Surfaces**: Analytics mode breakdown ("success rate" for Learn and Match) and category
  breakdown.
- **Formula**: `round(Σ correct / Σ answered × 100)` across completed sessions in range, grouped by
  mode or by flag category. Uses [Session Correct Count](#session-correct-count) and
  [Session Total Questions](#session-total-questions) for mode, and per-question tallies for
  category.
- **Empty value**: `0` when `Σ answered = 0`.
- **Category inclusion**: a question whose flag record was deleted has no category, so it is left
  out of the category breakdown. It still counts toward session score, mode accuracy, and totals.
  The audit reports such questions under a `(missing flag)` category so they remain visible.

### Total Time Practiced

- **Surfaces**: Analytics "Time Practiced"; admin profile "Time Spent" (practice portion).
- **Producers**: `getAnalyticsSummary`, `getUserProfile` (admin).
- **Formula**: sum of [Session Active Time](#session-active-time) over completed sessions in range.
- **Empty value**: `0`.

### Average Session Time

- **Surfaces**: Analytics "Avg Session Time".
- **Formula**: `round(Total Time Practiced / Sessions Completed)` (ms).
- **Empty value**: `0`.

### Average Response Time

- **Function**: `computeAverageResponseTimeMs(sessions)`
- **Surfaces**: Results "Avg per flag" badge (one session), Analytics "Avg Response Time" (range).
- **Formula**: mean of all [Response Time](#response-time) values from completed sessions in range
  that have timestamps.
- **Rounding**: `Math.round` to whole milliseconds. The UI shows seconds to 1 decimal.
- **Empty value**: `null` (shown as "—") when no session has timing data. Legacy sessions are
  excluded, not estimated.

### Current Day Streak

- **Functions**: `computeSessionDayStreaks(completedSessions, now).current`, which wraps
  `computeDayStreaks(dayKeys, todayKey)`. The same call is used by the dashboard, analytics, and
  the admin profile.
- **Surfaces**: Dashboard "Current Streak"; admin profile "Learning Streak".
- **Day key**: `toLocalDayKey(completedAt)`, which gives `YYYY-MM-DD` in `STATS_TIME_ZONE`.
- **Formula**: number of consecutive calendar days with at least one completed session, ending on
  today or yesterday. If the latest active day is earlier than yesterday, the value is `0`. Gaps
  are never tolerated.
- **Inclusion**: completed sessions, **all history** (ignores the date-range filter).
- **Edge cases**: Day arithmetic uses calendar dates, not 24-hour intervals, so DST changes don't
  skip or duplicate a day. A session that starts before midnight and finishes after it counts on
  the `completedAt` day.

### Longest Day Streak

- **Function**: `computeSessionDayStreaks(completedSessions, now).longest`
- **Surfaces**: Analytics "Best Streak".
- **Formula**: the longest run of consecutive day keys in history. Always `>= current`.
- **Empty value**: `0`.

### Flags Practiced

- **Surfaces**: Practice page "Unique Flags Practiced".
- **Formula**: number of **distinct** flag ids across completed sessions.
- **Empty value**: `0`.

### Flags Mastered

- **Function**: `isFlagMastered({ attempts, misses })`
- **Surfaces**: Analytics Mastery grid (top N), admin profile "Flags Mastered" (count).
- **Formula**: a flag is mastered if, within range, `attempts >= 2` and `misses = 0`, counting each
  appearance in a completed session.
- **Empty value**: `0` / empty list.

### Miss Rate

- **Surfaces**: Analytics "Challenging Flags".
- **Producer**: `getMostMissedFlags`.
- **Formula**: `round(misses / attempts × 100)` per flag. Only flags with `misses > 0` are listed,
  sorted by miss rate (descending) and then by misses (descending).

### Weekly Frequency

- **Function**: `toIsoWeekKey(dayKey)`
- **Surfaces**: Analytics practice frequency chart.
- **Formula**: count of completed sessions in range, bucketed by the ISO-8601 week (`YYYY-Www`,
  weeks start on Monday) of `toLocalDayKey(completedAt)`.
- **Edge cases**: The ISO week-year can differ from the calendar year near 1 January (for example,
  2027-01-01, a Friday, falls in `2026-W53`).

### Last Practiced

- **Surfaces**: Practice page "Last Practice".
- **Formula**: the latest `completedAt` among completed sessions.
- **Empty value**: `undefined` (shown as "Never").

---

## In-session Stats

### In-session Accuracy

- **Surfaces**: Quiz progress during an active session.
- **Producer**: `getCurrentQuestion`.
- **Formula**: `round(correct so far / answered so far × 100)`. The denominator is answered
  questions, not total questions.
- **Empty value**: `0` before the first answer.

### In-session Answer Streak

- **Surfaces**: Feedback modal, streak indicator, milestone celebrations.
- **Producers**: `submitAnswer`, `getCurrentQuestion`.
- **Formula**: number of consecutive correct answers ending at the most recent answer.
- **Note**: This is unrelated to [Current Day Streak](#current-day-streak).

---

## Implementation Status

Each row shows the task in `specs/004-session-stats-audit/tasks.md` that brings the code in line
with this document. Once all tasks are complete, T037 removes this section.

| Stat | Status | Task(s) |
|------|--------|---------|
| Session score / correct / total | Done | T008, T013, T014 |
| Average / Best / Worst score | Done | T009, T010, T011 |
| Accuracy (mode/category) | Mode done (T009); category unchanged, already question-weighted | T009 |
| Sessions Completed | Done | T031, T032 |
| Day streaks | Done | T020, T021 |
| Response time / Active time / Avg response | Done | T023–T029 |
| Flags Practiced / Mastered | Done | T031, T033 |
| Weekly Frequency | Done | T034 |
| Last Practiced | Done | T031 |
| Results placeholder for missing flags | Done | T035 |
