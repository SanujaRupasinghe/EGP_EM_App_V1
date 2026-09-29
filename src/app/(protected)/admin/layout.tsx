import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentProfile } from "@/lib/auth";

const ADMIN_LINKS = [
  { href: "/admin/employees", label: "Employees" },
  { href: "/admin/sections", label: "Sections" },
  { href: "/admin/work-types", label: "Estate Works" },
  { href: "/admin/time-presets", label: "Time Presets" },
  { href: "/admin/rates", label: "Pay Rates" },
  { href: "/admin/holidays", label: "Holidays" },
  { href: "/admin/import-daily", label: "Import Data" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/audit", label: "Audit Log" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getCurrentProfile();
  if (!session) redirect("/login");
  if (session.profile?.role !== "admin") redirect("/dashboard");

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-slate-900">Admin</h1>
      <div className="-mx-1 flex gap-1 overflow-x-auto pb-1">
        {ADMIN_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="whitespace-nowrap rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            {link.label}
          </Link>
        ))}
      </div>
      {children}
    </div>
  );
}
