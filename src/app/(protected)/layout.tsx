import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { Sidebar } from "@/components/nav/sidebar";
import { BottomNav } from "@/components/nav/bottom-nav";
import { SignOutButton } from "@/components/nav/sign-out-button";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const session = await getCurrentProfile();
  if (!session) redirect("/login");

  const isAdmin = session.profile?.role === "admin";
  const userName = session.profile?.full_name ?? session.email ?? "";

  return (
    <div className="flex min-h-dvh bg-slate-50">
      <Sidebar isAdmin={isAdmin} userName={userName} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:hidden">
          <div>
            <p className="text-sm font-semibold text-emerald-800">Tea Estate Daily Report</p>
            <p className="text-xs text-slate-500">
              {userName}
              {isAdmin ? " · Admin" : ""}
            </p>
          </div>
          <SignOutButton />
        </header>
        <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-24 pt-4 md:max-w-6xl md:px-8 md:pb-10 md:pt-6">
          {children}
        </main>
        <BottomNav isAdmin={isAdmin} />
      </div>
    </div>
  );
}
