"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Play, Square, CheckCircle2, EyeOff, Timer } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface FocusItem {
  taskId: string;
  subtaskId: string;
  title: string;
  minutes: number;
}

type Phase = "idle" | "running" | "done";

export function FocusSession({ items }: { items: FocusItem[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<FocusItem | null>(items[0] ?? null);
  const [plannedMin, setPlannedMin] = useState(items[0]?.minutes ?? 25);
  const [phase, setPhase] = useState<Phase>("idle");
  const [elapsed, setElapsed] = useState(0); // seconds
  const [distractions, setDistractions] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const totalSeconds = plannedMin * 60;
  const remaining = Math.max(0, totalSeconds - elapsed);

  // Tick.
  useEffect(() => {
    if (phase !== "running") return;
    tickRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [phase]);

  // Auto-finish when the planned time elapses.
  useEffect(() => {
    if (phase === "running" && elapsed >= totalSeconds) setPhase("done");
  }, [phase, elapsed, totalSeconds]);

  // Distraction detection: leaving the tab while focusing costs you.
  useEffect(() => {
    if (phase !== "running") return;
    const onHide = () => {
      if (document.hidden) {
        setDistractions((d) => d + 1);
        toast.warning("Stay focused — leaving costs credits.");
      }
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [phase]);

  function start() {
    setElapsed(0);
    setDistractions(0);
    setPhase("running");
  }

  async function finish(complete: boolean) {
    setPhase("done");
    setSubmitting(true);
    const actualMinutes = Math.max(1, Math.round(elapsed / 60));
    try {
      const res = await fetch("/api/focus/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: selected?.taskId,
          subtaskId: selected?.subtaskId,
          actualMinutes,
          distractions,
          completeSubtask: complete && !!selected?.subtaskId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save session");
      if (data.kind === "completion") {
        toast.success(`Done! +${data.result?.creditsAwarded ?? 0} credits`, {
          description: `${actualMinutes} min focused · ${distractions} distractions`,
        });
      } else {
        toast.success(`Focus logged · +${data.credits} credits`, {
          description: `${actualMinutes} min · ${distractions} distractions`,
        });
      }
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
      setPhase("idle");
      setElapsed(0);
      setDistractions(0);
    }
  }

  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");
  const progress = totalSeconds > 0 ? elapsed / totalSeconds : 0;

  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-6 py-8">
        {/* Timer ring */}
        <div className="relative h-56 w-56">
          <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="var(--muted)"
              strokeWidth="6"
            />
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="var(--primary)"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={`${progress * 283} 283`}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-mono text-5xl font-bold tabular-nums">
              {mm}:{ss}
            </span>
            <span className="mt-1 text-sm text-muted-foreground">
              {phase === "running" ? "focusing" : "ready"}
            </span>
          </div>
        </div>

        {/* Distraction counter */}
        {phase !== "idle" && (
          <div
            className={cn(
              "flex items-center gap-2 rounded-full px-3 py-1 text-sm",
              distractions > 0
                ? "bg-rose-500/10 text-rose-600"
                : "bg-emerald-500/10 text-emerald-600"
            )}
          >
            <EyeOff className="h-3.5 w-3.5" />
            {distractions} distraction{distractions === 1 ? "" : "s"}
          </div>
        )}

        {/* What are you focusing on */}
        {phase === "idle" && (
          <div className="w-full max-w-md space-y-2">
            <p className="text-center text-sm font-medium">
              What are you focusing on?
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {items.map((it) => (
                <button
                  key={it.subtaskId || it.title}
                  onClick={() => {
                    setSelected(it);
                    setPlannedMin(it.minutes);
                  }}
                  className={cn(
                    "rounded-lg border px-3 py-1.5 text-sm transition-colors",
                    selected?.subtaskId === it.subtaskId
                      ? "border-primary bg-primary text-primary-foreground"
                      : "hover:bg-muted"
                  )}
                >
                  {it.title} · {it.minutes}m
                </button>
              ))}
              <button
                onClick={() => {
                  setSelected(null);
                  setPlannedMin(25);
                }}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors",
                  !selected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "hover:bg-muted"
                )}
              >
                <Timer className="h-3.5 w-3.5" />
                Just focus · 25m
              </button>
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="flex gap-3">
          {phase === "idle" ? (
            <Button size="lg" className="gap-2" onClick={start}>
              <Play className="h-4 w-4" />
              Start focus
            </Button>
          ) : (
            <>
              {selected?.subtaskId && (
                <Button
                  size="lg"
                  className="gap-2"
                  disabled={submitting}
                  onClick={() => finish(true)}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Complete subtask
                </Button>
              )}
              <Button
                size="lg"
                variant="outline"
                className="gap-2"
                disabled={submitting}
                onClick={() => finish(false)}
              >
                <Square className="h-4 w-4" />
                End session
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
