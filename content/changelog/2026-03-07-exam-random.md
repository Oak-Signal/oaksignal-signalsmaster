---
version: "0.2.0"
date: "2026-03-07"
title: "Randomized Exam Question Generation"
stage: "Pre Alpha"
category: "feature"
---

### Added
- Convex mutation generating a full exam covering all flags in the database, with server-side randomized question order.
- Shuffled multiple-choice options per question, with no duplicate flags in a single exam.
- Exam attempt records storing userId, startTime, totalQuestions, and attempt number.
- Exam seed stored for reproducibility and audit purposes.

### Security
- Correct answers withheld from the client; all answer validation handled server-side.