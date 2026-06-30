<div align="center">

# Paula

### AI that turns intentions into execution

Paula is an **autonomous execution planner** — not a to-do list. You state *what*
you want; Paula decides *how*, *when*, and *in what order*, schedules it into your
real calendar, continuously reschedules against reality, and tells you the
**probability you'll actually finish on time**.

</div>

---

## Why Paula

Most productivity tools assume you're a good planner. You're not — nobody is.
People know *what* they need to do but struggle with *how*, *when*, and *in what
order*. Planning itself requires executive function. **Paula performs that
executive function for you.**

## What it does

| Capability | What happens |
|---|---|
| 🧩 **Intelligent decomposition** | Gemini breaks a vague goal into small, time-boxed, dependency-aware subtasks with effort, difficulty, and energy estimates. |
| 📅 **Automatic time-blocking** | A deterministic scheduler packs subtasks into your *real* Google Calendar free time, around your work hours, peak-focus hours, and recovery breaks. |
| ♻️ **A living schedule** | New meeting? Overslept? Task ran long? Paula rebuilds the plan automatically — on demand and autonomously in the background. |
| 📊 **Commitment Confidence Engine** | The differentiator: Paula estimates the *probability* each plan succeeds and proactively recommends fixes when it's shaky. |
| 💬 **Conversational agent** | Tell Paula a goal in plain language; via Gemini function-calling it decomposes, schedules, and writes to your calendar — real actions, not chat. |
| 🏆 **Gamified accountability** | Credits, streaks, achievements, and Group Spaces leaderboards. Missing commitments costs credits. |
| 🔔 **Adaptive reminders** | Context-aware nudges that escalate if ignored. |
| 🎯 **Focus mode** | Distraction-aware focus sessions; leaving the tab costs credits. Real elapsed time feeds the learning loop. |
| 🧠 **Learning system** | Paula learns your true effort multiplier, reliability, and peak hours — planning gets more personal over time. |

## Architecture

Paula separates **judgment** (the LLM) from **placement** (deterministic code):

- **Gemini** owns decomposition, effort estimation, recommendations, and the
  conversational agent (function calling).
- A **deterministic scheduler** (`src/services/scheduler.ts`) packs subtasks
  into free slots — predictable, dependency-aware, unit-tested.
- The **Confidence Engine** (`src/services/confidence.ts`) is transparent math,
  calibrated and unit-tested.

```
src/
  app/                     Next.js App Router (pages + API routes)
    api/                   plan, agent, replan, cron/replan, reminders, spaces, focus…
    dashboard/             Today, Tasks, Calendar, Confidence, Activity, Focus, Leaderboard
  lib/                     gemini, calendar, google, firestore, time, session, env
  services/                planner, scheduler, decompose, confidence, assessment,
                           gamification, reminders, learning, spaces, tasks, users
  components/              UI (shadcn / Base UI) + dashboard widgets
```

## Tech stack

- **Next.js 16** (App Router, TypeScript) on **Cloud Run**
- **Gemini API** (`@google/genai`) — `gemini-2.5-pro` for planning, `gemini-2.5-flash` for the agent
- **Google Calendar API** (free/busy + event CRUD)
- **Google Identity / OAuth 2.0** (Auth.js) with offline refresh tokens
- **Firestore** (Firebase Admin)
- **Cloud Scheduler** — autonomous background replanning
- **Tailwind v4 + shadcn (Base UI)**, **Vitest**

## Getting started

See **[SETUP.md](./SETUP.md)** for the full free-tier setup (no credit card).
Short version:

```bash
npm install
cp .env.example .env.local     # fill in the 6 values (see SETUP.md)
npm run dev                     # http://localhost:3000
```

## Scripts

```bash
npm run dev      # local dev
npm run build    # production build (standalone output for Docker/Cloud Run)
npm test         # unit tests (scheduler, time, confidence)
```

## Tests

The reliability-critical pure logic is unit-tested:

```bash
npm test
# scheduler.test.ts   — dependency-aware packing, recovery breaks, peak hours
# time.test.ts        — timezone-aware free-slot computation
# confidence.test.ts  — confidence calibration + recommendations
```

---

<div align="center">
Turn intentions into consistent execution.
</div>
