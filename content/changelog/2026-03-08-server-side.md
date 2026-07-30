---
version: "0.2.0"
date: "2026-03-08"
title: "Server-Side Answer Validation and Scoring"
stage: "Pre Alpha"
category: "feature"
---

### Added
- Convex mutations validating all exam answers server-side, with no correct-answer exposure to the client.
- Server-calculated running score and final pass/fail determination (80% threshold), withheld from client until exam completion.
- Duplicate-submission detection and exam session/attempt ID verification on each answer.
- Detailed post-exam statistics broken down by category and mode.

### Security
- Validation failures logged for security review; rate limiting applied to answer submissions.