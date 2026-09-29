import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { AdminTabs } from "@/components/admin/admin-tabs";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getCurrentProfile();
  if (!session) redirect("/login");
  if (session.profile?.role !== "admin") redirect("/dashboard");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Admin</h1>
        <p className="text-sm text-slate-500">Manage estate configuration, accounts, and records.</p>
      </div>
      <AdminTabs />
      {children}
    </div>
  );
}
