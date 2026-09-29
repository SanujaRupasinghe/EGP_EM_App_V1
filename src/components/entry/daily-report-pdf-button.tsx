"use client";

import { Button } from "@/components/ui/button";
import { formatDate, formatLKR } from "@/lib/utils";
import type {
  Attendance,
  CashEntry,
  CashSummary,
  Employee,
  JobLine,
  Section,
  TeaCollector,
  TimePreset,
  TransportLog,
  WorkType,
} from "@/lib/supabase/types";

type AttendanceRow = Attendance & { job_lines: JobLine[] };

function esc(v: unknown): string {
  return String(v ?? "").replace(/[&<>"]/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&quot;",
  );
}

function hhmm(t: string | null | undefined): string {
  return t ? t.slice(0, 5) : "";
}

// Pairs job lines two-at-a-time to match the paper template's two side-by-side
// job slots per worker row; a worker with 0 or 1 jobs still gets one row, and
// more than 2 jobs simply continues onto extra rows for the same worker.
function pairJobLines(lines: JobLine[]): [JobLine | undefined, JobLine | undefined][] {
  const pairs: [JobLine | undefined, JobLine | undefined][] = [];
  const count = Math.max(lines.length, 1);
  for (let i = 0; i < count; i += 2) {
    pairs.push([lines[i], lines[i + 1]]);
  }
  return pairs;
}

export function DailyReportPdfButton({
  reportDate,
  employees,
  sections,
  workTypes,
  timePresets,
  attendance,
  transport,
  teaCollector,
  cashSummary,
  cashEntries,
  broughtForward,
}: {
  reportDate: string;
  employees: Employee[];
  sections: Section[];
  workTypes: WorkType[];
  timePresets: TimePreset[];
  attendance: AttendanceRow[];
  transport: TransportLog | null;
  teaCollector: TeaCollector | null;
  cashSummary: CashSummary | null;
  cashEntries: CashEntry[];
  broughtForward: number;
}) {
  function handlePrint() {
    const win = window.open("", "_blank", "width=900,height=1100");
    if (!win) return;

    const employeeById = new Map(employees.map((e) => [e.id, e]));
    const sectionById = new Map(sections.map((s) => [s.id, s]));
    const workTypeById = new Map(workTypes.map((w) => [w.id, w]));
    const timePresetById = new Map(timePresets.map((t) => [t.id, t]));

    const jobCell = (jl: JobLine | undefined, tp: TimePreset | undefined) => {
      if (!jl) return { start: "", end: "", section: "", work: "", amount: "" };
      const section = sectionById.get(jl.section_id);
      const workType = workTypeById.get(jl.work_type_id);
      return {
        start: hhmm(tp?.start_time),
        end: hhmm(tp?.end_time),
        section: esc(section?.code ?? ""),
        work: esc(workType?.code.replace(/_/g, " ") ?? ""),
        amount: jl.quantity_kg != null ? String(jl.quantity_kg) : "",
      };
    };

    const rowsHtml = attendance
      .flatMap((a) => {
        const employee = employeeById.get(a.employee_id);
        const tp = timePresetById.get(a.time_preset_id);
        const pairs = pairJobLines(a.job_lines);
        return pairs.map(([left, right], i) => {
          const l = jobCell(left, tp);
          const r = jobCell(right, tp);
          const isFirst = i === 0;
          return `<tr>
            <td>${isFirst ? esc(employee?.code) : ""}</td>
            <td>${isFirst ? esc(employee?.name) : ""}</td>
            <td>${l.start}</td>
            <td>${l.end}</td>
            <td>${l.section}</td>
            <td>${l.work}</td>
            <td>${l.amount}</td>
            <td class="gap"></td>
            <td>${r.start}</td>
            <td>${r.end}</td>
            <td>${r.section}</td>
            <td>${r.work}</td>
            <td>${r.amount}</td>
            <td>${isFirst && a.advance_amount ? String(a.advance_amount) : ""}</td>
          </tr>`;
        });
      })
      .join("");

    const incomeRows = cashEntries
      .filter((e) => e.type === "income")
      .map((e) => `<tr><td>${esc(e.reason)}</td><td>${formatLKR(e.amount)}</td></tr>`)
      .join("");
    const expenseRows = cashEntries
      .filter((e) => e.type === "expense")
      .map((e) => `<tr><td>${esc(e.reason)}</td><td>${formatLKR(e.amount)}</td></tr>`)
      .join("");

    win.document.write(`<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Daily Report — ${esc(formatDate(reportDate))}</title>
<style>
  @page { size: A4; margin: 14mm; }
  body { font-family: system-ui, sans-serif; color: #0f172a; margin: 0; }
  .page { padding: 6mm 0; }
  .page + .page { page-break-before: always; }
  .header { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 10px; }
  h1 { font-size: 18px; margin: 0; }
  h2 { font-size: 13px; margin: 0 0 8px; }
  .date { font-size: 12px; }
  table { width: 100%; border-collapse: collapse; font-size: 10px; table-layout: fixed; }
  th, td { border: 1px solid #000; padding: 3px 4px; text-align: left; height: 16px; overflow: hidden; }
  th { background: #f1f5f9; font-weight: 700; }
  td.gap, th.gap { border: none; width: 6px; }
  .mini { width: auto; margin-top: 14px; border-collapse: collapse; font-size: 11px; }
  .mini td, .mini th { border: 1px solid #000; padding: 4px 8px; }
  .mini-row { display: flex; gap: 24px; margin-top: 10px; }
  .box-title { font-weight: 700; font-size: 11px; margin-bottom: 4px; }
  .remarks-box { border: 1px solid #000; min-height: 100px; padding: 6px; margin-top: 6px; font-size: 11px; }
</style>
</head>
<body>
  <div class="page">
    <div class="header">
      <h1>Daily Report</h1>
      <span class="date">Date: ${esc(formatDate(reportDate))}</span>
    </div>
    <table>
      <thead>
        <tr>
          <th style="width:6%">ID</th>
          <th style="width:16%">Name</th>
          <th style="width:6%">Start</th>
          <th style="width:6%">End</th>
          <th style="width:9%">Section</th>
          <th style="width:11%">Work</th>
          <th style="width:8%">Amount</th>
          <th class="gap"></th>
          <th style="width:6%">Start</th>
          <th style="width:6%">End</th>
          <th style="width:9%">Section</th>
          <th style="width:11%">Work</th>
          <th style="width:8%">Amount</th>
          <th style="width:8%">Advance</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml || `<tr><td colspan="14" style="text-align:center;color:#64748b">No workers recorded</td></tr>`}
      </tbody>
    </table>

    <div class="mini-row">
      <div>
        <table class="mini">
          <tr><th colspan="2">Transport</th></tr>
          <tr><td>Login</td><td>${transport?.login_available ? hhmm(transport.login_time) || "Available" : "Not available"}</td></tr>
          <tr><td>Logout</td><td>${transport?.logout_available ? hhmm(transport.logout_time) || "Available" : "Not available"}</td></tr>
        </table>
      </div>
      <div>
        <table class="mini">
          <tr><th colspan="2">Tea Collector</th></tr>
          <tr><td>Arrived</td><td>${teaCollector?.arrived ? "Yes" : "No"}</td></tr>
          <tr><td>Amount</td><td>${teaCollector?.amount_kg != null ? `${teaCollector.amount_kg} kg` : ""}</td></tr>
        </table>
      </div>
    </div>
  </div>

  <div class="page">
    <div class="header">
      <span></span>
      <span class="date">Date: ${esc(formatDate(reportDate))}</span>
    </div>
    <h2>Cash Summary</h2>
    <p style="font-size:12px;margin:0 0 6px">Brought forward: ${formatLKR(broughtForward)}</p>
    <table>
      <thead>
        <tr>
          <th style="width:33%">Receive</th>
          <th style="width:33%">Expences</th>
          <th style="width:34%">Balence</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>${cashSummary ? formatLKR(cashSummary.receive) : ""}</td>
          <td>${cashSummary ? formatLKR(cashSummary.expenses) : ""}</td>
          <td>${formatLKR(broughtForward + (cashSummary?.receive ?? 0) - (cashSummary?.expenses ?? 0))}</td>
        </tr>
      </tbody>
    </table>

    <div class="mini-row">
      <div>
        <table class="mini">
          <tr><th colspan="2">Income</th></tr>
          ${incomeRows || `<tr><td colspan="2">None</td></tr>`}
        </table>
      </div>
      <div>
        <table class="mini">
          <tr><th colspan="2">Expenses</th></tr>
          ${expenseRows || `<tr><td colspan="2">None</td></tr>`}
        </table>
      </div>
    </div>

    <h2 style="margin-top:20px">Remarks</h2>
    <div class="remarks-box">${esc(cashSummary?.remarks ?? "")}</div>
  </div>
</body>
</html>`);
    win.document.close();
    win.focus();
    win.onload = () => win.print();
  }

  return (
    <Button variant="secondary" size="sm" onClick={handlePrint}>
      Print / PDF
    </Button>
  );
}
