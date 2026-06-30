"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format, addDays } from "date-fns";
import { toast } from "sonner";
import { Sparkles, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const IMPORTANCE = [
  { value: 2, label: "Low" },
  { value: 3, label: "Normal" },
  { value: 4, label: "High" },
  { value: 5, label: "Critical" },
];

function defaultDeadline(): string {
  const d = addDays(new Date(), 2);
  d.setHours(18, 0, 0, 0);
  return format(d, "yyyy-MM-dd'T'HH:mm");
}

export function GoalComposer() {
  const router = useRouter();
  const [goal, setGoal] = useState("");
  const [deadline, setDeadline] = useState(defaultDeadline);
  const [importance, setImportance] = useState(3);
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (goal.trim().length < 3) {
      toast.error("Tell Paula what you want to accomplish.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goal: goal.trim(),
          deadline: new Date(deadline).toISOString(),
          importance,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || "Planning failed");
      }
      toast.success(`Planned “${data.title}”`, {
        description: `${data.scheduledCount} subtasks scheduled${
          data.unscheduledCount
            ? `, ${data.unscheduledCount} couldn't fit before the deadline`
            : ""
        }.`,
      });
      setGoal("");
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardContent className="space-y-4 py-5">
        <div className="space-y-2">
          <Label htmlFor="goal" className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            What do you want to get done?
          </Label>
          <Textarea
            id="goal"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="e.g. Finish my Operating Systems assignment by Friday"
            rows={2}
            disabled={loading}
          />
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="space-y-2">
            <Label htmlFor="deadline">Deadline</Label>
            <Input
              id="deadline"
              type="datetime-local"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              disabled={loading}
              className="w-full sm:w-auto"
            />
          </div>

          <div className="space-y-2">
            <Label>Importance</Label>
            <div className="flex gap-1">
              {IMPORTANCE.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setImportance(opt.value)}
                  disabled={loading}
                  className={cn(
                    "rounded-md border px-3 py-1.5 text-sm transition-colors",
                    importance === opt.value
                      ? "border-primary bg-primary text-primary-foreground"
                      : "hover:bg-muted"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <Button
            onClick={submit}
            disabled={loading}
            className="gap-2 sm:ml-auto"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Paula is planning…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Plan it
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
