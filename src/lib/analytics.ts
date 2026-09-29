import { formatDate } from "@/lib/utils";
import type { JobLineDetailRow, Section } from "@/lib/supabase/types";
import type { BarDatum } from "@/components/analysis/charts/bar-chart";
import type { DayDatum } from "@/components/analysis/charts/daily-trend-chart";

export function eachDate(from: string, to: string): string[] {
  const dates: string[] = [];
  const d = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  while (d <= end) {
    dates.push(d.toLocaleDateString("en-CA"));
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

export type WorkerSectionAggregates = {
  totalKg: number;
  daysWorked: number;
  workerKgChart: BarDatum[];
  workerDaysChart: BarDatum[];
  sectionChart: BarDatum[];
  workTypeChart: BarDatum[];
};

/** Aggregates a set of v_job_lines_detail rows into the chart data every
 * Analysis/Dashboard chart needs — kept in one place so both pages compute
 * "worker performance" / "section performance" the same way. */
export function aggregateJobLines(
  detail: JobLineDetailRow[],
  limit = 15,
): WorkerSectionAggregates {
  const workerAgg = new Map<string, { label: string; kg: number; days: Set<string> }>();
  const sectionAgg = new Map<string, number>();
  const workTypeAgg = new Map<string, number>();
  const daysWithData = new Set<string>();
  let totalKg = 0;

  for (const r of detail) {
    const kg = Number(r.quantity_kg ?? 0);
    totalKg += kg;
    daysWithData.add(r.report_date);

    const existing = workerAgg.get(r.employee_id);
    if (existing) {
      existing.kg += kg;
      existing.days.add(r.report_date);
    } else {
      workerAgg.set(r.employee_id, {
        label: `${r.employee_code} — ${r.employee_name}`,
        kg,
        days: new Set([r.report_date]),
      });
    }

    sectionAgg.set(r.section_code, (sectionAgg.get(r.section_code) ?? 0) + kg);
    const workLabel = r.work_type_code.replace(/_/g, " ");
    workTypeAgg.set(workLabel, (workTypeAgg.get(workLabel) ?? 0) + kg);
  }

  const workerKgChart = Array.from(workerAgg.values())
    .map((w) => ({ label: w.label, value: w.kg }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
  const workerDaysChart = Array.from(workerAgg.values())
    .map((w) => ({ label: w.label, value: w.days.size }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
  const sectionChart = Array.from(sectionAgg.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
  const workTypeChart = Array.from(workTypeAgg.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);

  return {
    totalKg,
    daysWorked: daysWithData.size,
    workerKgChart,
    workerDaysChart,
    sectionChart,
    workTypeChart,
  };
}

/** Daily total across the full [from, to] range, including zero for days
 * with no report — the gap is the point (holidays, rain days), so it's never
 * interpolated away like a line chart would.
 *
 * `metric` picks what "amount" means for the work type being charted: kg for
 * quantity-tracked work (plucking, fertilizing), or the day_fraction (worker
 * -days) for work like weeding that isn't measured in kg at all. */
export function buildDailyChart(
  detail: JobLineDetailRow[],
  from: string,
  to: string,
  metric: "quantity_kg" | "day_fraction" = "quantity_kg",
): DayDatum[] {
  const dailyAgg = new Map<string, number>();
  for (const r of detail) {
    const amount = metric === "quantity_kg" ? Number(r.quantity_kg ?? 0) : Number(r.day_fraction ?? 0);
    dailyAgg.set(r.report_date, (dailyAgg.get(r.report_date) ?? 0) + amount);
  }
  return eachDate(from, to).map((date) => ({
    date,
    label: formatDate(date),
    dayLabel: String(new Date(`${date}T00:00:00`).getDate()),
    value: dailyAgg.get(date) ?? 0,
  }));
}

export type SectionYieldRow = {
  sectionId: string;
  code: string;
  teaKg: number;
};

/** Tea-plucking kg per section for the selected range. */
export function buildSectionYield(
  detail: JobLineDetailRow[],
  sections: Section[],
): SectionYieldRow[] {
  const kgBySection = new Map<string, number>();
  for (const r of detail) {
    if (r.work_type_code !== "Tea_Plucking") continue;
    kgBySection.set(r.section_id, (kgBySection.get(r.section_id) ?? 0) + Number(r.quantity_kg ?? 0));
  }

  return sections
    .map((s) => ({ sectionId: s.id, code: s.code, teaKg: kgBySection.get(s.id) ?? 0 }))
    .filter((r) => r.teaKg > 0)
    .sort((a, b) => b.teaKg - a.teaKg);
}
