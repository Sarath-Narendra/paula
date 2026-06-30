import { format, parseISO, isPast } from "date-fns";
import { CalendarClock, Clock, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CompleteButton } from "@/components/dashboard/complete-button";
import type { ScheduleBlock, Subtask, Task } from "@/lib/types";

const IMPORTANCE_LABEL: Record<number, string> = {
  1: "Trivial",
  2: "Low",
  3: "Normal",
  4: "High",
  5: "Critical",
};

const ENERGY_COLOR: Record<string, string> = {
  low: "bg-emerald-500",
  medium: "bg-amber-500",
  high: "bg-rose-500",
};

function scheduledLabel(block?: ScheduleBlock): string | null {
  if (!block) return null;
  try {
    const start = parseISO(block.start);
    const end = parseISO(block.end);
    return `${format(start, "EEE MMM d, h:mm a")} – ${format(end, "h:mm a")}`;
  } catch {
    return null;
  }
}

export function TaskCard({
  task,
  subtasks,
  blocks,
}: {
  task: Task;
  subtasks: Subtask[];
  blocks: ScheduleBlock[];
}) {
  const blockBySubtask = new Map(
    blocks.filter((b) => b.type === "work").map((b) => [b.subtaskId, b])
  );
  const deadline = parseISO(task.deadline);
  const overdue = isPast(deadline) && task.status === "active";

  return (
    <Card>
      <CardHeader className="gap-2">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-lg font-semibold leading-tight">{task.title}</h3>
          {typeof task.confidence === "number" && (
            <ConfidenceBadge value={task.confidence} />
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="secondary">{IMPORTANCE_LABEL[task.importance]}</Badge>
          <span
            className={cn(
              "flex items-center gap-1.5",
              overdue && "text-destructive"
            )}
          >
            <CalendarClock className="h-3.5 w-3.5" />
            {overdue ? "Overdue · " : "Due "}
            {format(deadline, "EEE MMM d, h:mm a")}
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {subtasks.map((s) => {
            const block = blockBySubtask.get(s.id);
            const label = scheduledLabel(block);
            const done = s.status === "done";
            return (
              <li
                key={s.id}
                className="flex items-start justify-between gap-3 rounded-lg border px-3 py-2"
              >
                <div className="flex min-w-0 items-start gap-2.5">
                  <CompleteButton taskId={task.id} subtaskId={s.id} done={done} />
                  <span
                    className={cn(
                      "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                      ENERGY_COLOR[s.energy] ?? "bg-muted-foreground"
                    )}
                    title={`${s.energy} energy`}
                  />
                  <div className="min-w-0">
                    <p
                      className={cn(
                        "font-medium leading-tight",
                        done && "text-muted-foreground line-through"
                      )}
                    >
                      {s.title}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {s.estDuration} min
                      {label ? (
                        <>
                          <span className="text-border">·</span>
                          {label}
                        </>
                      ) : (
                        <>
                          <span className="text-border">·</span>
                          <span className="flex items-center gap-1 text-amber-600">
                            <AlertCircle className="h-3 w-3" />
                            not scheduled yet
                          </span>
                        </>
                      )}
                    </p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

function ConfidenceBadge({ value }: { value: number }) {
  const tone =
    value >= 75
      ? "bg-emerald-500/15 text-emerald-600"
      : value >= 50
        ? "bg-amber-500/15 text-amber-600"
        : "bg-rose-500/15 text-rose-600";
  return (
    <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", tone)}>
      {Math.round(value)}% confidence
    </span>
  );
}
