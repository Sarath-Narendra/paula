import { getSessionContext } from "@/lib/session";
import { getUser } from "@/services/users";
import { deriveAchievements } from "@/services/gamification";
import {
  getUserSpaces,
  getGlobalLeaderboard,
  getSpaceLeaderboard,
  type LeaderboardRow,
} from "@/services/spaces";
import { SpacesPanel } from "@/components/dashboard/spaces-panel";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Flame, Coins, CheckCircle2, Lock, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
  const ctx = await getSessionContext();
  if (!ctx) return null;

  const user = await getUser(ctx.uid);
  const achievements = user ? deriveAchievements(user) : [];
  const spaces = await getUserSpaces(ctx.uid);
  const space = spaces[0];

  const rows: LeaderboardRow[] = space
    ? await getSpaceLeaderboard(space)
    : await getGlobalLeaderboard(20);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Leaderboard</h1>
        <p className="text-muted-foreground">
          Execution earns credits. Compete with friends, teams, and classes —
          accountability beats willpower.
        </p>
      </div>

      {/* Personal stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          icon={<Coins className="h-5 w-5" />}
          label="Credits"
          value={user?.credits ?? 0}
        />
        <StatCard
          icon={<Flame className="h-5 w-5" />}
          label="Day streak"
          value={user?.streak ?? 0}
        />
        <StatCard
          icon={<CheckCircle2 className="h-5 w-5" />}
          label="Tasks done"
          value={user?.tasksCompleted ?? 0}
        />
      </div>

      <SpacesPanel
        currentSpace={
          space
            ? { id: space.id, name: space.name, members: space.memberUids.length }
            : undefined
        }
      />

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Ranking */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Trophy className="h-4 w-4 text-primary" />
              {space ? `${space.name} ranking` : "Global ranking"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-1">
              {rows.map((row, i) => {
                const isMe = row.uid === ctx.uid;
                return (
                  <li
                    key={row.uid}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2",
                      isMe && "bg-accent"
                    )}
                  >
                    <span className="w-6 text-center text-sm font-semibold text-muted-foreground">
                      {i + 1}
                    </span>
                    <Avatar className="h-7 w-7">
                      {row.image && <AvatarImage src={row.image} />}
                      <AvatarFallback>
                        {row.name.slice(0, 1).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="flex-1 truncate text-sm font-medium">
                      {row.name}
                      {isMe && (
                        <span className="ml-1.5 text-xs text-muted-foreground">
                          (you)
                        </span>
                      )}
                    </span>
                    {row.streak > 0 && (
                      <span className="flex items-center gap-1 text-xs text-amber-600">
                        <Flame className="h-3 w-3" />
                        {row.streak}
                      </span>
                    )}
                    <span className="w-16 text-right text-sm font-semibold tabular-nums">
                      {row.credits}
                    </span>
                  </li>
                );
              })}
              {rows.length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No one on the board yet. Complete a subtask to get on it.
                </p>
              )}
            </ol>
          </CardContent>
        </Card>

        {/* Achievements */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Achievements</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2">
            {achievements.map((a) => (
              <div
                key={a.id}
                className={cn(
                  "rounded-lg border p-3",
                  a.unlocked ? "bg-card" : "opacity-50"
                )}
              >
                <div className="mb-1 flex items-center gap-1.5">
                  {a.unlocked ? (
                    <Trophy className="h-4 w-4 text-amber-500" />
                  ) : (
                    <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                  <p className="text-sm font-medium">{a.label}</p>
                </div>
                <p className="text-xs text-muted-foreground">{a.description}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 py-5">
        <div className="rounded-xl bg-accent p-2.5 text-primary">{icon}</div>
        <div>
          <p className="text-2xl font-bold tabular-nums">{value}</p>
          <p className="text-sm text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
