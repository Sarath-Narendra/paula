"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Users, Plus, LogIn } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function SpacesPanel({
  currentSpace,
}: {
  currentSpace?: { id: string; name: string; members: number };
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function act(body: Record<string, unknown>, ok: string) {
    setBusy(true);
    try {
      const res = await fetch("/api/spaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      toast.success(ok, data.space ? { description: `Code: ${data.space.id}` } : undefined);
      setName("");
      setCode("");
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (currentSpace) {
    return (
      <Card>
        <CardContent className="flex items-center justify-between gap-3 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-accent p-2.5 text-primary">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="font-medium">{currentSpace.name}</p>
              <p className="text-sm text-muted-foreground">
                {currentSpace.members} member
                {currentSpace.members > 1 ? "s" : ""} · invite code{" "}
                <span className="font-mono font-semibold text-foreground">
                  {currentSpace.id}
                </span>
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() => act({ action: "leave", code: currentSpace.id }, "Left space")}
          >
            Leave
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="grid gap-4 py-5 sm:grid-cols-2">
        <div className="space-y-2">
          <p className="text-sm font-medium">Create a Group Space</p>
          <div className="flex gap-2">
            <Input
              placeholder="e.g. CS Class of '26"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={busy}
            />
            <Button
              disabled={busy || !name.trim()}
              onClick={() => act({ action: "create", name: name.trim() }, "Space created")}
              className="gap-1.5"
            >
              <Plus className="h-4 w-4" />
              Create
            </Button>
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium">Join with a code</p>
          <div className="flex gap-2">
            <Input
              placeholder="ABC123"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              disabled={busy}
              className="font-mono uppercase"
            />
            <Button
              variant="outline"
              disabled={busy || code.trim().length < 4}
              onClick={() => act({ action: "join", code: code.trim() }, "Joined space")}
              className="gap-1.5"
            >
              <LogIn className="h-4 w-4" />
              Join
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
