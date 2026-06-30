import { format, parseISO } from "date-fns";
import { getSessionContext } from "@/lib/session";
import { listTasks } from "@/services/tasks";
import { assessTask, type TaskAssessment } from "@/services/assessment";
import { ConfidenceGauge } from "@/components/dashboard/confidence-gauge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Gauge, Lightbulb, CalendarClock } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ConfidencePage() {
  const ctx = await getSessionContext();

  let assessments: TaskAssessment[] = [];
  if (ctx) {
    const tasks = (await listTasks(ctx.uid)).filter((t) => t.status === "active");
    const results = await Promise.all(
      tasks.map((t) => assessTask(ctx.uid, ctx.client, t.id, { narrate: true }))
    );
    assessments = results.filter((r): r is TaskAssessment => r !== null);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Commitment Confidence
        </h1>
        <p className="text-muted-foreground">
          Not just a schedule — the probability you&apos;ll actually finish each
          commitment on time, recomputed against your live calendar.
        </p>
      </div>

      {assessments.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <div className="rounded-xl bg-accent p-3 text-primary">
              <Gauge className="h-6 w-6" />
            </div>
            <p className="max-w-sm text-muted-foreground">
              No active commitments yet. Create a plan and Paula will tell you
              whether it&apos;s realistically achievable.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {assessments.map(({ task, result, recommendations, narration }) => (
            <Card key={task.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-3 text-base">
                  <span>{task.title}</span>
                  <span className="flex items-center gap-1.5 text-sm font-normal text-muted-foreground">
                    <CalendarClock className="h-3.5 w-3.5" />
                    {format(parseISO(task.deadline), "EEE MMM d, h:mm a")}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-6 sm:flex-row sm:items-center">
                <div className="shrink-0 self-center">
                  <ConfidenceGauge value={result.confidence} />
                </div>
                <div className="flex-1 space-y-3">
                  {narration && (
                    <p className="text-sm font-medium">{narration}</p>
                  )}
                  {recommendations.length > 0 ? (
                    <ul className="space-y-2">
                      {recommendations.map((rec, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-2.5 rounded-lg border bg-muted/30 px-3 py-2"
                        >
                          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                          <div>
                            <p className="text-sm font-medium">{rec.title}</p>
                            <p className="text-sm text-muted-foreground">
                              {rec.detail}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-emerald-600">
                      This plan looks realistic. Keep executing — you&apos;re on
                      track.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
