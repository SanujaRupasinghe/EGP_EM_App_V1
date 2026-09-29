"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  ClipboardList,
  History,
  BarChart3,
  Wallet,
  ShieldCheck,
} from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

export function BottomNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();

  const items: NavItem[] = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/entry", label: "Today", icon: ClipboardList },
    { href: "/history", label: "History", icon: History },
    { href: "/analysis", label: "Analysis", icon: BarChart3 },
    { href: "/payroll", label: "Payroll", icon: Wallet },
    ...(isAdmin ? [{ href: "/admin", label: "Admin", icon: ShieldCheck }] : []),
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
      <ul className="mx-auto flex max-w-2xl">
        {items.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                className={cn(
                  "flex flex-col items-center gap-0.5 py-2 text-xs",
                  active ? "text-emerald-700" : "text-slate-500",
                )}
              >
                <Icon className="h-5 w-5" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
