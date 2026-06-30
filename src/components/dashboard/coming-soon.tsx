import { Card, CardContent } from "@/components/ui/card";
import { Sparkles } from "lucide-react";

export function ComingSoon({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <div className="rounded-xl bg-accent p-3 text-primary">
            <Sparkles className="h-6 w-6" />
          </div>
          <p className="max-w-md text-muted-foreground">{description}</p>
        </CardContent>
      </Card>
    </div>
  );
}
