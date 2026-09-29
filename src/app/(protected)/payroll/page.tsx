import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { todayColombo, formatDate } from "@/lib/utils";
import { periodForDate, periodPageNumber, shiftPeriod } from "@/lib/payroll";
import { PayrollTable, type PayrollRow } from "@/components/payroll/payroll-table";
import { Button } from "@/components/ui/button";
import type { AttendancePayRow, PayrollAdjustment } from "@/lib/supabase/types";

export default async function PayrollPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const session = await getCurrentProfile();
  if (!session) redirect("/login");

  const params = await searchParams;
  const anchor = params.date || todayColombo();
  const period = periodForDate(anchor);

  const supabase = await createClient();
  const [{ data: payRows }, { data: adjustments }] = await Promise.all([
    supabase
      .from("v_attendance_pay")
      .select("*")
      .gte("report_date", period.start)
      .lte("report_date", period.end),
    supabase
      .from("payroll_adjustments")
      .select("*")
      .eq("period_start", period.start)
      .eq("period_end", period.end),
  ]);

  const adjustmentByEmployee = new Map(
    (adjustments as PayrollAdjustment[] | null)?.map((a) => [a.employee_id, a]),
  );

  const grouped = new Map<string, PayrollRow>();
  for (const r of (payRows as AttendancePayRow[] | null) ?? []) {
    const existing = grouped.get(r.employee_id);
    const adj = adjustmentByEmployee.get(r.employee_id);
    if (existing) {
      existing.days += Number(r.day_fraction);
      existing.gross += Number(r.final_pay);
      existing.advances += Number(r.advance_amount);
      existing.teaKg += Number(r.plucked_kg ?? 0);
    } else {
      grouped.set(r.employee_id, {
        employeeId: r.employee_id,
        code: r.employee_code,
        name: r.employee_name,
        days: Number(r.day_fraction),
        rate: Number(r.day_rate),
        gross: Number(r.final_pay),
        advances: Number(r.advance_amount),
        teaKg: Number(r.plucked_kg ?? 0),
        allowance: adj?.allowance ?? 0,
        loan: adj?.loan ?? 0,
      });
    }
  }
  const rows = Array.from(grouped.values()).sort((a, b) => a.code.localeCompare(b.code));

  const prevAnchor = shiftPeriod(period, -1);
  const nextAnchor = shiftPeriod(period, 1);
  const periodLabel = `${formatDate(period.start)} – ${formatDate(period.end)}`;
  const monthLabel = new Date(`${period.start}T00:00:00`).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
  const periodPage = periodPageNumber(period.start);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">Payroll</h1>
        <div className="flex gap-2">
          <Link href={`/payroll?date=${prevAnchor}`}>
            <Button variant="secondary" size="sm">
              ← Prev
            </Button>
          </Link>
          <Link href={`/payroll?date=${nextAnchor}`}>
            <Button variant="secondary" size="sm">
              Next →
            </Button>
          </Link>
        </div>
      </div>
      <p className="text-sm text-slate-600">Period: {periodLabel}</p>
      <PayrollTable
        rows={rows}
        periodStart={period.start}
        periodEnd={period.end}
        monthLabel={monthLabel}
        periodPage={periodPage}
      />
    </div>
  );
}
