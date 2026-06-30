"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Circle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function CompleteButton({
  taskId,
  subtaskId,
  done,
}: {
  taskId: string;
  subtaskId: string;
  done: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  if (done) {
    return (
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
        <Check className="h-3.5 w-3.5" />
      </span>
    );
  }

  async function complete() {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/subtasks/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, subtaskId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not complete");
      toast.success(
        data.taskCompleted
          ? `Task complete! +${data.creditsAwarded} credits 🎉`
          : `Nice — +${data.creditsAwarded} credits`,
        { description: `${data.streak}-day streak · ${data.totalCredits} total` }
      );
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={complete}
      disabled={loading}
      title="Mark done"
      className={cn(
        "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-muted-foreground/50 transition-colors",
        "hover:border-emerald-500 hover:text-emerald-500"
      )}
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Circle className="h-3.5 w-3.5" />
      )}
    </button>
  );
}
