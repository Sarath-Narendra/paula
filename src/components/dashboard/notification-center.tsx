"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow, parseISO } from "date-fns";
import { Bell, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Reminder {
  id: string;
  message: string;
  deliverAt: string;
  escalationLevel: number;
}

const ESCALATION_LABEL = ["", "Reminder", "Still pending", "Don't let this slip"];

export function NotificationCenter() {
  const router = useRouter();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [dueCount, setDueCount] = useState(0);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/reminders");
      if (!res.ok) return;
      const data = await res.json();
      setReminders(data.reminders ?? []);
      setDueCount(data.dueCount ?? 0);
    } catch {
      // ignore transient errors
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);

  async function ack(id: string) {
    setReminders((r) => r.filter((x) => x.id !== id));
    setDueCount((c) => Math.max(0, c - 1));
    await fetch("/api/reminders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    router.refresh();
  }

  const now = Date.now();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon" className="relative" title="Reminders" />
        }
      >
        <Bell className="h-4 w-4" />
        {dueCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
            {dueCount}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="border-b px-4 py-3">
          <p className="text-sm font-semibold">Reminders</p>
          <p className="text-xs text-muted-foreground">
            Paula nudges you at the right moment — and escalates if ignored.
          </p>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {reminders.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              You&apos;re all caught up.
            </p>
          ) : (
            reminders.map((r) => {
              const due = new Date(r.deliverAt).getTime() <= now;
              return (
                <div
                  key={r.id}
                  className="flex items-start gap-2 border-b px-4 py-3 last:border-0"
                >
                  <div className="min-w-0 flex-1">
                    {r.escalationLevel > 0 && (
                      <span
                        className={cn(
                          "mb-0.5 inline-block text-[10px] font-bold uppercase tracking-wide",
                          r.escalationLevel >= 2
                            ? "text-rose-600"
                            : "text-amber-600"
                        )}
                      >
                        {ESCALATION_LABEL[r.escalationLevel] ?? "Urgent"}
                      </span>
                    )}
                    <p className="text-sm leading-tight">{r.message}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {due ? "now" : formatDistanceToNow(parseISO(r.deliverAt), { addSuffix: true })}
                    </p>
                  </div>
                  <button
                    onClick={() => ack(r.id)}
                    title="Dismiss"
                    className="mt-0.5 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
