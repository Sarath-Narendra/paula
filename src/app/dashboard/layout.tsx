import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { PaulaLogo } from "@/components/brand";
import { Sidebar } from "@/components/dashboard/sidebar";
import { NotificationCenter } from "@/components/dashboard/notification-center";
import { Button } from "@/components/ui/button";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { LogOut } from "lucide-react";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/signin");

  const { name, email, image } = session.user;
  const initials = (name ?? email ?? "U")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex min-h-screen flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b bg-background/80 px-4 py-3 backdrop-blur sm:px-6">
        <PaulaLogo />
        <div className="flex items-center gap-3">
          <NotificationCenter />
          <div className="hidden text-right sm:block">
            <p className="text-sm font-medium leading-none">{name}</p>
            <p className="text-xs text-muted-foreground">{email}</p>
          </div>
          <Avatar className="h-8 w-8">
            {image && <AvatarImage src={image} alt={name ?? ""} />}
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/" });
            }}
          >
            <Button type="submit" variant="ghost" size="icon" title="Sign out">
              <LogOut className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-7xl flex-1">
        {/* Sidebar */}
        <aside className="hidden w-56 shrink-0 border-r p-4 md:block">
          <Sidebar />
        </aside>
        {/* Main */}
        <main className="min-w-0 flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
