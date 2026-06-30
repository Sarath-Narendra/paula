import { getSessionContext } from "@/lib/session";
import {
  listTasks,
  listSubtasks,
  listBlocksForTask,
} from "@/services/tasks";
import { GoalComposer } from "@/components/dashboard/goal-composer";
import { TaskCard } from "@/components/dashboard/task-card";
import { Card, CardContent } from "@/components/ui/card";
import { ListTodo } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const ctx = await getSessionContext();

  const tasks = ctx ? await listTasks(ctx.uid) : [];
  const enriched = await Promise.all(
    tasks.map(async (task) => ({
      task,
      subtasks: ctx ? await listSubtasks(ctx.uid, task.id) : [],
      blocks: ctx ? await listBlocksForTask(ctx.uid, task.id) : [],
    }))
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Tasks</h1>
        <p className="text-muted-foreground">
          State a goal. Paula breaks it down and schedules it into your real
          free time.
        </p>
      </div>

      <GoalComposer />

      {enriched.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <div className="rounded-xl bg-accent p-3 text-primary">
              <ListTodo className="h-6 w-6" />
            </div>
            <p className="max-w-sm text-muted-foreground">
              No plans yet. Tell Paula what you want to accomplish above and it
              will build your first execution plan.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {enriched.map(({ task, subtasks, blocks }) => (
            <TaskCard
              key={task.id}
              task={task}
              subtasks={subtasks}
              blocks={blocks}
            />
          ))}
        </div>
      )}
    </div>
  );
}
