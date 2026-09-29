import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { todayColombo, formatDate } from "@/lib/utils";
import { periodForDate, periodPageNumber, shiftPeriod } from "@/lib/payroll";
import { eachDate } from "@/lib/analytics";
import { PayrollRangeFilter } from "@/components/payroll/payroll-range-filter";
import { PayrollTable, type PayrollRow } from "@/components/payroll/payroll-table";
import { Button } from "@/components/ui/button";
import type { AttendancePayRow, PayrollAdjustment } from "@/lib/supabase/types";

// Allowance is auto-suggested (still editable per employee below) when
// someone worked more than 80% of the calendar days in the selected range.
const ALLOWANCE_ATTENDANCE_THRESHOLD = 0.8;
const ALLOWANCE_AMOUNT = 1500;

export default async function PayrollPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; from?: string; to?: string }>;
}) {
  const session = await getCurrentProfile();
  if (!session) redirect("/login");

  const params = await searchParams;
  const anchor = params.date || todayColombo();
  const period = periodForDate(anchor);
  // A custom range (from the range filter below) overrides the fixed 10-day
  // period that Prev/Next step through — both live side by side so the
  // paper-period shortcuts keep working alongside free-form ranges.
  const from = params.from || period.start;
  const to = params.to || period.end;
  const dates = eachDate(from, to);

  const supabase = await createClient();
  const [{ data: payRows }, { data: adjustments }] = await Promise.all([
    supabase.from("v_attendance_pay").select("*").gte("report_date", from).lte("report_date", to),
    supabase
      .from("payroll_adjustments")
      .select("*")
      .eq("period_start", from)
      .eq("period_end", to),
  ]);

  const adjustmentByEmployee = new Map(
    (adjustments as PayrollAdjustment[] | null)?.map((a) => [a.employee_id, a]),
  );

  type GroupedRow = Omit<PayrollRow, "allowance" | "loan">;
  const grouped = new Map<string, GroupedRow>();
  for (const r of (payRows as AttendancePayRow[] | null) ?? []) {
    const pay = Number(r.final_pay);
    const existing = grouped.get(r.employee_id);
    if (existing) {
      existing.days += Number(r.day_fraction);
      existing.gross += pay;
      existing.advances += Number(r.advance_amount);
      existing.teaKg += Number(r.plucked_kg ?? 0);
      existing.dailyPay[r.report_date] = (existing.dailyPay[r.report_date] ?? 0) + pay;
    } else {
      grouped.set(r.employee_id, {
        employeeId: r.employee_id,
        code: r.employee_code,
        name: r.employee_name,
        days: Number(r.day_fraction),
        rate: Number(r.day_rate),
        gross: pay,
        advances: Number(r.advance_amount),
        teaKg: Number(r.plucked_kg ?? 0),
        dailyPay: { [r.report_date]: pay },
      });
    }
  }

  const rows: PayrollRow[] = Array.from(grouped.values())
    .map((g) => {
      const adj = adjustmentByEmployee.get(g.employeeId);
      const autoAllowance =
        dates.length > 0 && g.days / dates.length > ALLOWANCE_ATTENDANCE_THRESHOLD
          ? ALLOWANCE_AMOUNT
          : 0;
      return {
        ...g,
        allowance: adj?.allowance ?? autoAllowance,
        loan: adj?.loan ?? 0,
      };
    })
    .sort((a, b) => a.code.localeCompare(b.code));

  const prevAnchor = shiftPeriod(period, -1);
  const nextAnchor = shiftPeriod(period, 1);
  const periodLabel = `${formatDate(from)} – ${formatDate(to)}`;
  const monthLabel = new Date(`${from}T00:00:00`).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
  const periodPage = periodPageNumber(from);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">Payroll</h1>
        <div className="flex gap-2">
          <Link href={`/payroll?date=${prevAnchor}`}>
            <Button variant="secondary" size="sm">
              ← Prev period
            </Button>
          </Link>
          <Link href={`/payroll?date=${nextAnchor}`}>
            <Button variant="secondary" size="sm">
              Next period →
            </Button>
          </Link>
        </div>
      </div>
      <PayrollRangeFilter from={from} to={to} />
      <p className="text-sm text-slate-600">Range: {periodLabel}</p>
      <PayrollTable
        rows={rows}
        dates={dates}
        periodStart={from}
        periodEnd={to}
        monthLabel={monthLabel}
        periodPage={periodPage}
      />
    </div>
  );
}
