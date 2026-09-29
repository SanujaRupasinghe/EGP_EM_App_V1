import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { todayColombo, formatDate } from "@/lib/utils";
import { FilterBar } from "@/components/analysis/filter-bar";
import { ExportCsvButton } from "@/components/analysis/export-csv-button";
import { WorkTypeKgChart } from "@/components/analysis/charts/work-type-kg-chart";
import { WorkTrendChart } from "@/components/analysis/charts/work-trend-chart";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { StatTile } from "@/components/ui/stat-tile";
import { aggregateJobLines } from "@/lib/analytics";
import type { JobLineDetailRow } from "@/lib/supabase/types";
import { LogIn, LogOut, Leaf } from "lucide-react";

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toLocaleDateString("en-CA");
}

export default async function AnalysisPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const session = await getCurrentProfile();
  if (!session) redirect("/login");

  const params = await searchParams;
  const today = todayColombo();
  const from = params.from || daysAgo(9);
  const to = params.to || today;

  const supabase = await createClient();
  const [
    { data: sections },
    { data: employees },
    { data: workTypes },
    { data: jobRows },
    { data: transportRows },
    { data: teaRows },
  ] = await Promise.all([
    supabase.from("sections").select("*").order("code"),
    supabase.from("employees").select("*").order("code"),
    supabase.from("work_types").select("*").order("code"),
    supabase
      .from("v_job_lines_detail")
      .select("*")
      .gte("report_date", from)
      .lte("report_date", to)
      .order("report_date", { ascending: false }),
    supabase
      .from("transport_log")
      .select("login_available, logout_available, daily_reports!inner(report_date)")
      .gte("daily_reports.report_date", from)
      .lte("daily_reports.report_date", to),
    supabase
      .from("tea_collector")
      .select("amount_kg, daily_reports!inner(report_date)")
      .gte("daily_reports.report_date", from)
      .lte("daily_reports.report_date", to),
  ]);

  const detail = (jobRows as JobLineDetailRow[] | null) ?? [];

  type SummaryRow = {
    employee_code: string;
    employee_name: string;
    work_type_code: string;
    totalKg: number;
    jobCount: number;
  };
  const summaryMap = new Map<string, SummaryRow>();
  for (const r of detail) {
    const key = `${r.employee_id}|${r.work_type_id}`;
    const existing = summaryMap.get(key);
    if (existing) {
      existing.totalKg += Number(r.quantity_kg ?? 0);
      existing.jobCount += 1;
    } else {
      summaryMap.set(key, {
        employee_code: r.employee_code,
        employee_name: r.employee_name,
        work_type_code: r.work_type_code,
        totalKg: Number(r.quantity_kg ?? 0),
        jobCount: 1,
      });
    }
  }
  const summary = Array.from(summaryMap.values()).sort(
    (a, b) => b.totalKg - a.totalKg || a.employee_code.localeCompare(b.employee_code),
  );
  const { totalKg } = aggregateJobLines(detail);

  const transportDays = transportRows ?? [];
  const loginAvailableDays = transportDays.filter((t) => t.login_available).length;
  const logoutAvailableDays = transportDays.filter((t) => t.logout_available).length;
  const teaCollectedKg = (teaRows ?? []).reduce((sum, t) => sum + Number(t.amount_kg ?? 0), 0);

  const sectionOptions = (sections ?? []).map((s) => ({ id: s.id, label: s.code }));
  const employeeOptions = (employees ?? []).map((e) => ({
    id: e.id,
    label: `${e.code} — ${e.name}`,
  }));

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-slate-900">Analysis</h1>
      <FilterBar initial={{ from, to }} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Worker performance</CardTitle>
          </CardHeader>
          <CardBody>
            <WorkTypeKgChart detail={detail} workTypes={workTypes ?? []} groupBy="employee" />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Section performance</CardTitle>
          </CardHeader>
          <CardBody>
            <WorkTypeKgChart detail={detail} workTypes={workTypes ?? []} groupBy="section" />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Section daily trend</CardTitle>
          </CardHeader>
          <CardBody>
            <WorkTrendChart
              detail={detail}
              workTypes={workTypes ?? []}
              groupOptions={sectionOptions}
              groupLabel="Section"
              groupKey="section_id"
              from={from}
              to={to}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Worker daily trend</CardTitle>
          </CardHeader>
          <CardBody>
            <WorkTrendChart
              detail={detail}
              workTypes={workTypes ?? []}
              groupOptions={employeeOptions}
              groupLabel="Employee"
              groupKey="employee_id"
              from={from}
              to={to}
            />
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">
            Transport &amp; tea collection ({formatDate(from)} – {formatDate(to)})
          </CardTitle>
        </CardHeader>
        <CardBody className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatTile
            label="Login transport available"
            value={`${loginAvailableDays} / ${transportDays.length}`}
            hint="days in range"
            icon={LogIn}
          />
          <StatTile
            label="Logout transport available"
            value={`${logoutAvailableDays} / ${transportDays.length}`}
            hint="days in range"
            icon={LogOut}
          />
          <StatTile
            label="Tea collected"
            value={`${teaCollectedKg.toFixed(1)} kg`}
            hint="total for range"
            icon={Leaf}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Export</CardTitle>
        </CardHeader>
        <CardBody className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-48">
            <p className="text-sm font-medium text-slate-900">
              Summary — {summary.length} row{summary.length === 1 ? "" : "s"}
            </p>
            <p className="text-xs text-slate-500">
              Per worker per work type ({formatDate(from)} – {formatDate(to)}), total {totalKg.toFixed(1)} kg.
            </p>
          </div>
          <ExportCsvButton
            rows={summary.map((s) => ({
              employee_code: s.employee_code,
              employee_name: s.employee_name,
              work_type: s.work_type_code,
              jobs: s.jobCount,
              total_kg: s.totalKg.toFixed(1),
            }))}
            filename={`analysis_summary_${from}_to_${to}.csv`}
          />
        </CardBody>
        <CardBody className="flex flex-wrap items-center gap-3 border-t border-slate-100">
          <div className="flex-1 min-w-48">
            <p className="text-sm font-medium text-slate-900">
              Detail — {detail.length} row{detail.length === 1 ? "" : "s"}
            </p>
            <p className="text-xs text-slate-500">One row per job line, matching the date range above.</p>
          </div>
          <ExportCsvButton
            rows={detail.map((r) => ({
              date: r.report_date,
              employee_code: r.employee_code,
              employee_name: r.employee_name,
              section: r.section_code,
              work_type: r.work_type_code,
              quantity_kg: r.quantity_kg ?? "",
              day_fraction: r.day_fraction,
            }))}
            filename={`analysis_detail_${from}_to_${to}.csv`}
          />
        </CardBody>
      </Card>
    </div>
  );
}
