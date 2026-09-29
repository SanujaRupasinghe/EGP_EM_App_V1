import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ClipboardList,
  History,
  BarChart3,
  Wallet,
  Users,
  Scale,
  CalendarCheck,
  CircleDollarSign,
  ArrowRight,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { todayColombo, formatDate, formatLKR } from "@/lib/utils";
import { aggregateJobLines } from "@/lib/analytics";
import { StatTile } from "@/components/ui/stat-tile";
import { Badge } from "@/components/ui/badge";
import type { JobLineDetailRow } from "@/lib/supabase/types";

function firstOfMonth(dateStr: string) {
  const [y, m] = dateStr.split("-");
  return `${y}-${m}-01`;
}

function daysInMonth(dateStr: string) {
  const [y, m] = dateStr.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

const QUICK_LINKS = [
  { href: "/entry", label: "Today's entry", hint: "Add attendance & jobs", icon: ClipboardList },
  { href: "/history", label: "History", hint: "Browse past reports", icon: History },
  { href: "/analysis", label: "Analysis", hint: "Filter & export data", icon: BarChart3 },
  { href: "/payroll", label: "Payroll", hint: "Current pay period", icon: Wallet },
];

export default async function DashboardPage() {
  const session = await getCurrentProfile();
  if (!session) redirect("/login");

  const supabase = await createClient();
  const today = todayColombo();
  const from = firstOfMonth(today);
  const totalDaysInMonth = daysInMonth(today);

  const { data: todayReport } = await supabase
    .from("daily_reports")
    .select("id, status")
    .eq("report_date", today)
    .maybeSingle();

  const [{ data: todayRows }, { data: rangeRows }] = await Promise.all([
    supabase.from("v_job_lines_detail").select("*").eq("report_date", today),
    supabase.from("v_job_lines_detail").select("*").gte("report_date", from).lte("report_date", today),
  ]);

  let cashBalanceToday: number | null = null;
  if (todayReport) {
    const { data: cash } = await supabase
      .from("cash_summary")
      .select("balance")
      .eq("daily_report_id", todayReport.id)
      .maybeSingle();
    cashBalanceToday = cash?.balance ?? null;
  }

  const todayDetail = (todayRows as JobLineDetailRow[] | null) ?? [];
  const rangeDetail = (rangeRows as JobLineDetailRow[] | null) ?? [];

  const todayWorkers = new Set(todayDetail.map((r) => r.employee_id)).size;
  const todayKg = todayDetail
    .filter((r) => r.work_type_code === "Tea_Plucking")
    .reduce((sum, r) => sum + Number(r.quantity_kg ?? 0), 0);

  const rangeAgg = aggregateJobLines(rangeDetail);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500">{formatDate(today)} · Colombo</p>
        </div>
        {todayReport ? (
          <Badge tone={todayReport.status === "finalized" ? "green" : "amber"}>
            {todayReport.status === "finalized" ? "Today finalized" : "Today in progress"}
          </Badge>
        ) : (
          <Badge tone="slate">Today not started</Badge>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Workers today" value={String(todayWorkers)} icon={Users} />
        <StatTile label="Tea kg today" value={todayKg.toFixed(1)} icon={Scale} />
        <StatTile
          label={`Days worked (From ${formatDate(from)})`}
          value={`${rangeAgg.daysWorked} / ${totalDaysInMonth}`}
          icon={CalendarCheck}
        />
        <StatTile
          label="Cash balance today"
          value={cashBalanceToday === null ? "—" : formatLKR(cashBalanceToday)}
          icon={CircleDollarSign}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {QUICK_LINKS.map((q) => (
          <Link
            key={q.href}
            href={q.href}
            className="group rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-emerald-300 hover:bg-emerald-50/40"
          >
            <q.icon className="h-5 w-5 text-emerald-700" />
            <p className="mt-2 flex items-center gap-1 text-sm font-medium text-slate-900">
              {q.label}
              <ArrowRight className="h-3.5 w-3.5 text-slate-400 transition-transform group-hover:translate-x-0.5" />
            </p>
            <p className="text-xs text-slate-500">{q.hint}</p>
          </Link>
        ))}
      </div>

      <Link
        href="/analysis"
        className="flex items-center justify-center gap-1 rounded-xl border border-dashed border-slate-300 bg-white py-3 text-sm font-medium text-emerald-700 hover:bg-emerald-50/40"
      >
        View full analysis with filters
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
