import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { todayColombo, formatDate } from "@/lib/utils";
import { FilterBar } from "@/components/analysis/filter-bar";
import { ExportCsvButton } from "@/components/analysis/export-csv-button";
import { BarChart } from "@/components/analysis/charts/bar-chart";
import { DailyTrendChart } from "@/components/analysis/charts/daily-trend-chart";
import { WorkTypeKgChart } from "@/components/analysis/charts/work-type-kg-chart";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { aggregateJobLines, buildDailyChart, buildSectionYield, eachDate } from "@/lib/analytics";
import type { JobLineDetailRow } from "@/lib/supabase/types";

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toLocaleDateString("en-CA");
}

const MAX_TREND_DAYS = 62;

export default async function AnalysisPage({
  searchParams,
}: {
  searchParams: Promise<{
    from?: string;
    to?: string;
    section?: string;
    employee?: string;
    workType?: string;
  }>;
}) {
  const session = await getCurrentProfile();
  if (!session) redirect("/login");

  const params = await searchParams;
  const today = todayColombo();
  const from = params.from || daysAgo(9);
  const to = params.to || today;

  const supabase = await createClient();
  const [{ data: sections }, { data: employees }, { data: workTypes }] = await Promise.all([
    supabase.from("sections").select("*").order("code"),
    supabase.from("employees").select("*").order("code"),
    supabase.from("work_types").select("*").order("code"),
  ]);

  // Fetched without the work-type filter so the per-chart work-type selectors
  // below (worker/section performance) always have every type's data to
  // switch between, regardless of what's picked in the filter bar.
  let query = supabase
    .from("v_job_lines_detail")
    .select("*")
    .gte("report_date", from)
    .lte("report_date", to)
    .order("report_date", { ascending: false });

  if (params.section) query = query.eq("section_id", params.section);
  if (params.employee) query = query.eq("employee_id", params.employee);

  const { data: rows } = await query;
  const allDetail = (rows as JobLineDetailRow[] | null) ?? [];
  const detail = params.workType
    ? allDetail.filter((r) => r.work_type_id === params.workType)
    : allDetail;

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

  const { totalKg, workerDaysChart, workTypeChart } = aggregateJobLines(detail);

  const rangeDates = eachDate(from, to);
  // One trend per estate work — tea/fertilizer kg and weeding worker-days are
  // different measurements, so they're never summed into a single line.
  const chartWorkTypes = workTypes ?? [];
  const dailyChartsByType = chartWorkTypes.map((wt) => ({
    workType: wt,
    data:
      rangeDates.length <= MAX_TREND_DAYS
        ? buildDailyChart(
            allDetail.filter((r) => r.work_type_id === wt.id),
            from,
            to,
            wt.requires_quantity ? "quantity_kg" : "day_fraction",
          )
        : [],
  }));

  const sectionsForYield = params.section
    ? (sections ?? []).filter((s) => s.id === params.section)
    : (sections ?? []);
  const sectionYield = buildSectionYield(allDetail, sectionsForYield);

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-slate-900">Analysis</h1>
      <FilterBar
        sections={sections ?? []}
        employees={employees ?? []}
        workTypes={workTypes ?? []}
        initial={{
          from,
          to,
          section: params.section ?? "",
          employee: params.employee ?? "",
          workType: params.workType ?? "",
        }}
      />

      {dailyChartsByType.map(({ workType, data }) => (
        <Card key={workType.id}>
          <CardHeader>
            <CardTitle className="text-sm">
              Daily total {workType.code.replace(/_/g, " ")}{" "}
              {workType.requires_quantity ? "kg" : "worker-days"} ({formatDate(from)} –{" "}
              {formatDate(to)})
            </CardTitle>
          </CardHeader>
          <CardBody>
            {data.length > 0 ? (
              <DailyTrendChart data={data} valueSuffix={workType.requires_quantity ? " kg" : " worker-days"} />
            ) : (
              <p className="py-6 text-center text-sm text-slate-400">
                {rangeDates.length > MAX_TREND_DAYS
                  ? `Select a range of ${MAX_TREND_DAYS} days or fewer to see the daily breakdown.`
                  : "No data for this range."}
              </p>
            )}
          </CardBody>
        </Card>
      ))}
      {chartWorkTypes.length === 0 && (
        <Card>
          <CardBody>
            <p className="py-6 text-center text-sm text-slate-400">
              No estate work types configured yet.
            </p>
          </CardBody>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Worker performance</CardTitle>
          </CardHeader>
          <CardBody>
            <WorkTypeKgChart detail={allDetail} workTypes={workTypes ?? []} groupBy="employee" />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Worker performance — days worked</CardTitle>
          </CardHeader>
          <CardBody>
            <BarChart
              data={workerDaysChart}
              decimals={0}
              valueSuffix={workerDaysChart.length === 1 ? " day" : " days"}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Section performance</CardTitle>
          </CardHeader>
          <CardBody>
            <WorkTypeKgChart detail={allDetail} workTypes={workTypes ?? []} groupBy="section" />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Estate work mix — total kg</CardTitle>
          </CardHeader>
          <CardBody>
            <BarChart data={workTypeChart} valueSuffix=" kg" />
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader className="justify-between">
          <CardTitle className="text-sm">Section tea yield — kg</CardTitle>
          <ExportCsvButton
            rows={sectionYield.map((r) => ({
              section: r.code,
              tea_kg: r.teaKg.toFixed(1),
            }))}
            filename={`section_yield_${from}_to_${to}.csv`}
          />
        </CardHeader>
        <CardBody>
          {sectionYield.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[320px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs text-slate-500">
                    <th className="px-2 py-2">Section</th>
                    <th className="px-2 py-2">Tea kg</th>
                  </tr>
                </thead>
                <tbody>
                  {sectionYield.map((r) => (
                    <tr key={r.sectionId} className="border-b border-slate-100">
                      <td className="px-2 py-2 whitespace-nowrap">{r.code}</td>
                      <td className="px-2 py-2 font-medium">{r.teaKg.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-slate-400">
              No tea plucked for this range yet.
            </p>
          )}
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
            <p className="text-xs text-slate-500">One row per job line, matching the filters above.</p>
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
