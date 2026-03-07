# 🚩 Signals Master

### Master Naval Signal Flags with Interactive Precision

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16.1-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)
[![Status](https://img.shields.io/badge/Status-Development-yellow)](https://github.com/mjsamaha/oaksignal-signalsmaster)

_Part of the **[OakSignal](https://mjsamaha.github.io/oaksignal-landing/)** ecosystem._

---

## 📖 About This Project

**Signals Master** is a mobile-friendly web application designed to help Sea Cadets learn, practice, and master naval signal flags and pennants.

Moving beyond static pen-and-paper testing, Signals Master offers an engaging, interactive digital experience that accelerates learning through immediate feedback, structured assessments, and competitive gamification.

**Primary Goals:**
*   **Modernize Learning:** Replace static diagrams with interactive quizzes.
*   **Accelerate Mastery:** Immediate feedback loops for faster recognition.
*   **Gamify Progress:** Ranked modes and leaderboards to motivate improvement.
*   **Empower Instructors:** Data-driven insights into cadet readiness.

---

## ✨ Features

Designed for both rapid learning and formal assessment:

- **🎓 Interactive Practice**: Customizable sessions (5-30+ flags) with two learning modes: "Identify by Name" and "Match Meaning".
- **🏆 Ranked Competitive Mode**: A timed, high-stakes mode where speed and accuracy determine fleet ranking.
- **📝 Formal Exams**: Structured assessments with immutable results for instructor review.
- **📚 Reference Guide**: A comprehensive, mobile-friendly encyclopedia of all standard naval flags and pennants.
- **🔒 Security First**: Integrated anti-cheat measures for exams and automated security scanning for code.

---

## 🛠️ Tech Stack

> Built with:

* **Framework / Library**: [React.js](https://reactjs.org/) + [Next.js 16](https://nextjs.org/) (App Router, Turbopack)
* **Language**: [TypeScript](https://www.typescriptlang.org/)
* **Styling / UI**: [Tailwind CSS](https://tailwindcss.com/) with [ShadCN/UI](https://ui.shadcn.com/)
* **Animations**: [Framer Motion](https://www.framer.com/motion/)
* **Database / Backend**: [Convex](https://convex.dev/)
* **Authentication**: [Clerk](https://clerk.com/)
  
---

## 🚀 Getting Started

Follow these steps to set up the project locally.

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher)
- [npm](https://www.npmjs.com/)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/mjsamaha/oaksignal-signalsmaster.git
   cd oaksignal-signalsmaster
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   Create a `.env.local` file in the root directory with your Clerk + Convex settings and exam security variables.
   Required for auth/backend:
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
   - `CLERK_SECRET_KEY`
   - `CLERK_WEBHOOK_SECRET`
   - `CLERK_ISSUER_URL`
   - `CONVEX_DEPLOYMENT`
   - `NEXT_PUBLIC_CONVEX_URL`
   - `NEXT_PUBLIC_CONVEX_SITE_URL`
   Required for official exam session security:
   - `EXAM_SESSION_TOKEN_SECRET` (minimum 32 characters)
   Optional hardening toggle:
   - `OFFICIAL_EXAM_IDLE_TIMEOUT_MS` (integer milliseconds, minimum `60000`; unset to disable idle timeout)

4. **Run the development server:**
   ```bash
   npm run dev
   ```

5. **Open your browser:**
   Navigate to [http://localhost:3000](http://localhost:3000).

### Security & Quality Hooks

This project uses **Husky** to enforce quality and security standards:

*   **Pre-commit**: Runs `gitleaks` (staged files) and `eslint` to prevent secrets and bad code from continuing.
*   **Pre-push**: Runs comprehensive `gitleaks` scans, basic secret pattern checks, and `npm run check` with formatted progress output.

Pre-push helper flags:
*   `PUSH_CHECKS_FAST=1`: Skip `npm run check` (local troubleshooting only).
*   `PUSH_CHECKS_VERBOSE=1`: Stream full command output live.
*   `PUSH_CHECKS_NO_SPINNER=1`: Disable spinner animation for non-interactive logs.

### Official Exam Security Ops Notes

* `EXAM_SESSION_TOKEN_SECRET` is mandatory for starting official exam attempts. Rotate it with care because existing in-progress exam session tokens will no longer validate.
* `OFFICIAL_EXAM_IDLE_TIMEOUT_MS` is optional and server-enforced at answer submission time. If idle time exceeds this value, the attempt is marked `abandoned`.
* Rollback path for idle timeout: remove/unset `OFFICIAL_EXAM_IDLE_TIMEOUT_MS` and redeploy Convex functions.

---

## 📂 Project Structure

```bash
/app
  ├── (marketing)/    # Public landing pages
  ├── dashboard/      # Protected cadet/admin dashboard
  ├── api/            # Serverless API routes
  └── layout.tsx      # Root layout
/components
  ├── ui/             # ShadCN/UI design system
  ├── dashboard/      # Dashboard widgets (Stats, Activity)
  ├── landing/        # Marketing page sections
  └── ...
/docs
  └── ...             # Detailed project documentation
/lib
  └── ...             # Utilities and mock data
/public               # Static assets (Flags, Icons)
```

---

## 🌲 About OakSignal

**OakSignal** provides purpose-built applications for training, operations, and public engagement in cadet and youth organizations.

### Core Values
- **Clarity**: Clear code, clear design, clear communication.
- **Accessibility**: Inclusive, usable systems for all.
- **Reliability**: Systems that work consistently.
- **Maintainability**: Sustainable, well-documented solutions.

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 📬 Contact

**OakSignal Team**

For inquiries, please visit the [OakSignal landing page](https://mjsamaha.github.io/oaksignal-landing/).

---
*Built with ❤️ for the Cadet Program.*
