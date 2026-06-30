import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";
import { PaulaLogo } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { CalendarCheck, Gauge, ListTree } from "lucide-react";

export default async function SignInPage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <PaulaLogo className="mb-6" />
          <h1 className="text-2xl font-semibold tracking-tight">
            Let Paula plan your execution
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Connect your Google account so Paula can read your calendar and
            schedule work into your real free time.
          </p>
        </div>

        <div className="rounded-2xl border bg-card p-6">
          <ul className="mb-6 space-y-3 text-sm">
            <li className="flex items-center gap-3">
              <ListTree className="h-4 w-4 text-primary" />
              Breaks your goals into scheduled, time-boxed steps
            </li>
            <li className="flex items-center gap-3">
              <CalendarCheck className="h-4 w-4 text-primary" />
              Reads & writes your Google Calendar
            </li>
            <li className="flex items-center gap-3">
              <Gauge className="h-4 w-4 text-primary" />
              Tells you if your plan is actually achievable
            </li>
          </ul>

          <form
            action={async () => {
              "use server";
              await signIn("google", { redirectTo: "/dashboard" });
            }}
          >
            <Button type="submit" size="lg" className="w-full gap-2">
              <GoogleIcon className="h-4 w-4" />
              Continue with Google
            </Button>
          </form>

          <p className="mt-4 text-center text-xs text-muted-foreground">
            Paula requests calendar access to plan and reschedule your work.
            You can revoke access anytime in your Google account.
          </p>
        </div>
      </div>
    </main>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5h-1.9V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8a12 12 0 1 1 0-24c3 0 5.8 1.1 7.9 3l5.7-5.7A20 20 0 1 0 24 44c11 0 20-8 20-20 0-1.3-.1-2.3-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="m6.3 14.7 6.6 4.8C14.7 16 19 13 24 13c3 0 5.8 1.1 7.9 3l5.7-5.7A20 20 0 0 0 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2A11.9 11.9 0 0 1 12.7 28l-6.5 5A20 20 0 0 0 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H24v8h11.3a12 12 0 0 1-4.1 5.6l6.2 5.2C41.4 36.4 44 30.8 44 24c0-1.3-.1-2.3-.4-3.5z"
      />
    </svg>
  );
}
