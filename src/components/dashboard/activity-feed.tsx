import { formatDistanceToNow, parseISO } from "date-fns";
import {
  CalendarSync,
  Sparkles,
  Gauge,
  Bell,
  Trophy,
  Brain,
  type LucideIcon,
} from "lucide-react";
import type { ActivityEntry } from "@/lib/types";
import { cn } from "@/lib/utils";

const KIND_META: Record<
  ActivityEntry["kind"],
  { icon: LucideIcon; className: string }
> = {
  plan: { icon: Sparkles, className: "text-primary bg-accent" },
  reschedule: { icon: CalendarSync, className: "text-blue-600 bg-blue-500/10" },
  reminder: { icon: Bell, className: "text-amber-600 bg-amber-500/10" },
  confidence: { icon: Gauge, className: "text-violet-600 bg-violet-500/10" },
  gamification: { icon: Trophy, className: "text-emerald-600 bg-emerald-500/10" },
  learning: { icon: Brain, className: "text-fuchsia-600 bg-fuchsia-500/10" },
};

export function ActivityFeed({ entries }: { entries: ActivityEntry[] }) {
  if (entries.length === 0) {
    return (
      <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
        Nothing yet. As Paula plans, reschedules, and adapts, every autonomous
        action shows up here.
      </p>
    );
  }

  return (
    <ol className="relative space-y-1">
      {entries.map((e) => {
        const meta = KIND_META[e.kind] ?? KIND_META.plan;
        const Icon = meta.icon;
        return (
          <li key={e.id} className="flex gap-3 rounded-lg p-2 hover:bg-muted/40">
            <div
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                meta.className
              )}
            >
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium leading-tight">{e.summary}</p>
              {e.detail && (
                <p className="text-sm text-muted-foreground">{e.detail}</p>
              )}
              <p className="mt-0.5 text-xs text-muted-foreground/70">
                {formatDistanceToNow(parseISO(e.createdAt), { addSuffix: true })}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
