import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { todayColombo, formatDate, compareEmployeeCodes } from "@/lib/utils";
import { periodForDate, periodPageNumber, shiftPeriod } from "@/lib/payroll";
import { eachDate } from "@/lib/analytics";
import { PayrollRangeFilter } from "@/components/payroll/payroll-range-filter";
import { PayrollTable, type PayrollRow } from "@/components/payroll/payroll-table";
import { Button } from "@/components/ui/button";
import type { AttendancePayRow, PayrollAdjustment } from "@/lib/supabase/types";

// Allowance: when someone worked at least 60% of the calendar days in the
// selected range, they get 200 LKR for every day worked.
const ALLOWANCE_ATTENDANCE_THRESHOLD = 0.6;
const ALLOWANCE_PER_DAY = 200;

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
  const [{ data: payRows, error: payError }, { data: adjustments }] = await Promise.all([
    supabase.from("v_attendance_pay").select("*").gte("report_date", from).lte("report_date", to),
    supabase
      .from("payroll_adjustments")
      .select("*")
      .eq("period_start", from)
      .eq("period_end", to),
  ]);

  const loanByEmployee = new Map(
    (adjustments as PayrollAdjustment[] | null)?.map((a) => [a.employee_id, Number(a.loan)]),
  );

  type GroupedRow = Omit<PayrollRow, "allowance" | "loan" | "workedOn"> & {
    fractions: Record<string, number>;
  };
  const grouped = new Map<string, GroupedRow>();
  for (const r of (payRows as AttendancePayRow[] | null) ?? []) {
    const fraction = Number(r.day_fraction);
    // Amount = rate × days worked (the rate in effect on each day).
    const amount = Number(r.day_rate) * fraction;
    const existing = grouped.get(r.employee_id);
    if (existing) {
      existing.days += fraction;
      existing.gross += amount;
      existing.rate = Number(r.day_rate);
      existing.advances += Number(r.advance_amount);
      existing.fractions[r.report_date] = (existing.fractions[r.report_date] ?? 0) + fraction;
    } else {
      grouped.set(r.employee_id, {
        employeeId: r.employee_id,
        code: r.employee_code,
        name: r.employee_name,
        days: fraction,
        rate: Number(r.day_rate),
        gross: amount,
        advances: Number(r.advance_amount),
        fractions: { [r.report_date]: fraction },
      });
    }
  }

  const rows: PayrollRow[] = Array.from(grouped.values())
    .map(({ fractions, ...g }) => {
      const allowance =
        dates.length > 0 && g.days / dates.length >= ALLOWANCE_ATTENDANCE_THRESHOLD
          ? g.days * ALLOWANCE_PER_DAY
          : 0;
      const workedOn = dates
        .filter((d) => fractions[d])
        .map((d) => `${Number(d.slice(8))}${fractions[d] < 1 ? "½" : ""}`)
        .join(", ");
      return { ...g, allowance, loan: loanByEmployee.get(g.employeeId) ?? 0, workedOn };
    })
    .sort((a, b) => compareEmployeeCodes(a.code, b.code));

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
      <PayrollRangeFilter key={`filter_${from}_${to}`} from={from} to={to} />
      <p className="text-sm text-slate-600">Range: {periodLabel}</p>
      {payError && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          Could not load payroll data: {payError.message}
        </p>
      )}
      <PayrollTable
        key={`table_${from}_${to}`}
        rows={rows}
        rangeLabel={
          from.slice(0, 7) === to.slice(0, 7)
            ? `${Number(from.slice(8))}–${Number(to.slice(8))}`
            : periodLabel
        }
        periodStart={from}
        periodEnd={to}
        monthLabel={monthLabel}
        periodPage={periodPage}
      />
    </div>
  );
}
