"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Triggers a live replan of the user's plans against their current calendar.
 * (Also happens autonomously via Cloud Scheduler; this is the on-demand path.)
 */
export function ReplanButton({ reason = "manual" }: { reason?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    try {
      const res = await fetch("/api/replan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || "Replan failed");
      if (data.changed > 0) {
        toast.success("Paula updated your plan", {
          description: `Adjusted ${data.changed} task${data.changed > 1 ? "s" : ""} to fit reality.`,
        });
      } else {
        toast.success("Everything's on track", {
          description: "No changes needed — your plan already fits.",
        });
      }
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button onClick={run} disabled={loading} variant="outline" className="gap-2">
      <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
      {loading ? "Re-planning…" : "Re-plan now"}
    </Button>
  );
}
