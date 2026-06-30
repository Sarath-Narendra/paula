# Paula — Submission Document

> Paste this into a Google Doc, set sharing to "Anyone with the link can view,"
> and submit the link on BlockseBlock. (See `rules.md` for all requirements.)

**Deployed app (Google Cloud / Cloud Run):** https://paula-uvfakv267q-uc.a.run.app
**GitHub repository:** https://github.com/Sarath-Narendra/paula
**Demo video:** _<paste your YouTube (Unlisted) or Drive link here>_

> Accessing the live app: sign-in uses Google OAuth with the Google Calendar
> scope, so the app is in Google's "Testing" mode (required while the sensitive
> Calendar scope is unverified). A reviewer's Google email can be whitelisted as
> a test user on request to try the full flow.

---

## Problem Statement Selected

**Problem Statement 1 — The Last-Minute Life Saver.** Build an AI-powered
productivity companion that proactively assists users in planning, prioritizing,
and completing tasks before deadlines are missed — moving beyond passive
reminders to help users take meaningful action.

## Solution Overview

**Paula is an autonomous execution planner.** Existing tools assume people are
good planners; in reality people know *what* they need to do but struggle with
*how*, *when*, and *in what order* — because planning itself requires executive
function. Paula performs that executive function.

You state a goal in plain language ("Finish my OS assignment by Friday"). Paula
then:

1. **Decomposes** it into small, time-boxed, dependency-aware subtasks (Gemini).
2. **Schedules** them into your *real* Google Calendar free time, respecting your
   work hours, peak-focus hours, dependencies, and recovery breaks.
3. **Continuously reschedules** as reality changes — a new meeting, an overrun, a
   missed session — both on demand and **autonomously in the background**.
4. **Tells you whether the plan is realistic** via the Commitment Confidence
   Engine, and proactively recommends fixes when confidence drops.

The schedule is a living system, not a static calendar. The user's only job is
to decide *what* they want; Paula handles everything else.

## Key Features

- **Intelligent task decomposition** — vague goals become concrete, time-boxed,
  ordered subtasks with effort, difficulty, and energy estimates.
- **Automatic time-blocking** — a deterministic, dependency-aware scheduler packs
  work into real calendar free slots, around commitments and energy.
- **Dynamic rescheduling (living schedule)** — full rebuild against the live
  calendar; preserves completed work, recovers missed sessions, resolves new
  conflicts. Runs autonomously via Cloud Scheduler even when the app is closed.
- **Commitment Confidence Engine** — the differentiator: a calibrated estimate of
  the probability each commitment is completed on time, with concrete,
  rule-based + AI-narrated recommendations when it's shaky.
- **Conversational agent** — Gemini function-calling turns natural language into
  real actions: it decomposes, schedules, and writes calendar events.
- **Gamified accountability** — credits, streaks, achievements, and Group Spaces
  leaderboards; missed commitments cost credits.
- **Adaptive reminders** — context-aware nudges that escalate if ignored.
- **Focus mode** — distraction-aware focus sessions (tab-switching costs
  credits); real elapsed time feeds the learning loop.
- **Learning system** — Paula learns each user's true effort multiplier,
  reliability, and peak-focus hours, personalizing future plans.

## Technologies Used

- **Next.js 16** (App Router, TypeScript) — full-stack web app
- **React 19**, **Tailwind CSS v4**, **shadcn/ui (Base UI)** — responsive UI
- **Auth.js (NextAuth v5)** — Google OAuth with offline refresh tokens
- **Firebase Admin SDK** — server-side Firestore access
- **Vitest** — unit tests for the scheduler, time math, and confidence engine
- **Docker** (standalone output) — container image for Cloud Run

## Google Technologies Utilized

- **Gemini API** (`@google/genai`) — task decomposition & effort estimation, the
  conversational function-calling agent, and recommendation narration
  (`gemini-2.5-flash`).
- **Google Calendar API** — free/busy queries and event create/update/delete;
  Paula reads availability and writes scheduled work blocks.
- **Google Identity / OAuth 2.0** — authentication and Calendar authorization
  with offline access (refresh tokens for autonomous background actions).
- **Cloud Firestore** — users, tasks, subtasks, schedule blocks, reminders,
  activity feed, and Group Spaces.
- **Cloud Run** — hosts the deployed application (containerized, scale-to-zero).
- **Cloud Build** — builds and deploys the container image to Cloud Run.
- **Cloud Scheduler** — triggers autonomous background rescheduling and reminder
  escalation.

---

### Demo Video

_Link: <https://drive.google.com/file/d/1nkLot7iPQwS8BizbsHVCRrl3jYTJZZiw/view?usp=sharing>_

The recording walks through the deployed app end-to-end on the live URL:
sign in with Google → state a goal in plain language → Paula decomposes it into
ordered subtasks → the scheduler places them into real Google Calendar free time
→ the events appear in Google Calendar → the Commitment Confidence score reports
how likely the plan is to finish on time.

---

### How Paula maps to the evaluation focus

Paula demonstrates **agentic depth** (an LLM agent that autonomously plans,
schedules, and rescheduling via tools — even unattended), **problem-solving
impact** (it helps users *complete* work, not just get reminded), and
**innovation** (the Commitment Confidence Engine turns a scheduler into an
execution advisor) — all built natively on Google technologies.
