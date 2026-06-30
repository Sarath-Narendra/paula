import { Brain } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { learningInsights } from "@/services/learning";
import type { UserProfile } from "@/lib/types";

/** Surfaces what Paula has learned about the user — the personalization loop. */
export function LearningCard({ user }: { user: UserProfile }) {
  const insights = learningInsights(user);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Brain className="h-4 w-4 text-primary" />
          What Paula has learned about you
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-3">
        {insights.map((i) => (
          <div key={i.label} className="rounded-lg border bg-muted/30 p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {i.label}
            </p>
            <p className="mt-1 text-sm font-medium">{i.value}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
