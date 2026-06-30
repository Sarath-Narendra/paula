import Link from "next/link";
import { PaulaLogo } from "@/components/brand";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  CalendarSync,
  Gauge,
  ListTree,
  BatteryCharging,
  ArrowRight,
} from "lucide-react";

const features = [
  {
    icon: ListTree,
    title: "Intelligent decomposition",
    body: "Vague goals become small, time-boxed, actionable steps — each with a duration, priority, and energy cost.",
  },
  {
    icon: CalendarSync,
    title: "A living schedule",
    body: "Paula places work into real calendar time and rebuilds the plan automatically when reality changes.",
  },
  {
    icon: Gauge,
    title: "Commitment confidence",
    body: "Before you commit, Paula tells you the probability you'll actually finish on time — and how to fix it.",
  },
  {
    icon: BatteryCharging,
    title: "Adaptive recovery",
    body: "Breaks, buffers, and deep-work windows are scheduled around your energy, not just your deadlines.",
  },
];

export default function Home() {
  return (
    <main className="flex flex-col">
      {/* Nav */}
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <PaulaLogo />
        <Button render={<Link href="/dashboard" />} variant="ghost">
          Open app
        </Button>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 -z-10 opacity-60"
          style={{
            background:
              "radial-gradient(60% 60% at 50% 0%, oklch(0.65 0.2 285 / 0.18), transparent 70%)",
          }}
        />
        <div className="mx-auto flex w-full max-w-4xl flex-col items-center px-6 pb-20 pt-16 text-center sm:pt-24">
          <span className="mb-5 inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-sm text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            AI that turns intentions into execution
          </span>
          <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-6xl">
            You decide <span className="text-primary">what</span>.
            <br />
            Paula handles <span className="text-primary">how</span>,{" "}
            <span className="text-primary">when</span>, and{" "}
            <span className="text-primary">in what order</span>.
          </h1>
          <p className="mt-6 max-w-2xl text-pretty text-lg text-muted-foreground">
            Most productivity tools assume you&apos;re a good planner. Paula is
            an autonomous execution planner: it breaks down your goals,
            schedules them into your real calendar, reschedules when life
            happens, and tells you whether your plan is actually achievable.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button
              render={<Link href="/dashboard" />}
              size="lg"
              className="gap-2"
            >
              Start planning <ArrowRight className="h-4 w-4" />
            </Button>
            <Button render={<Link href="#how" />} size="lg" variant="outline">
              See how it works
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="how" className="mx-auto w-full max-w-6xl px-6 pb-24">
        <div className="grid gap-4 sm:grid-cols-2">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border bg-card p-6 transition-colors hover:border-primary/40"
            >
              <div className="mb-4 inline-flex rounded-xl bg-accent p-2.5 text-primary">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-medium">{f.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="mt-auto border-t">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6 text-sm text-muted-foreground">
          <PaulaLogo />
          <span>Turn intentions into consistent execution.</span>
        </div>
      </footer>
    </main>
  );
}
