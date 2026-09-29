"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Users,
  MapPin,
  Sprout,
  Clock,
  Wallet,
  CalendarOff,
  Upload,
  UserCog,
  ScrollText,
} from "lucide-react";

const ADMIN_LINKS = [
  { href: "/admin/employees", label: "Employees", icon: Users },
  { href: "/admin/sections", label: "Sections", icon: MapPin },
  { href: "/admin/work-types", label: "Estate Works", icon: Sprout },
  { href: "/admin/time-presets", label: "Time Presets", icon: Clock },
  { href: "/admin/rates", label: "Pay Rates", icon: Wallet },
  { href: "/admin/holidays", label: "Holidays", icon: CalendarOff },
  { href: "/admin/import-daily", label: "Import Data", icon: Upload },
  { href: "/admin/users", label: "Users", icon: UserCog },
  { href: "/admin/audit", label: "Audit Log", icon: ScrollText },
];

export function AdminTabs() {
  const pathname = usePathname();

  return (
    <div className="-mx-1 flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm">
      {ADMIN_LINKS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-emerald-700 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        );
      })}
    </div>
  );
}
