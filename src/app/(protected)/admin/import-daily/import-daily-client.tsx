"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { parseCsv, downloadCsv } from "@/lib/csv";
import {
  importAttendanceRows,
  importDailySummaryRows,
  type AttendanceCsvRow,
  type DailySummaryCsvRow,
} from "./actions";

const ATTENDANCE_COLUMNS = [
  "report_date",
  "employee_code",
  "time_preset_label",
  "advance_amount",
  "section_code",
  "work_type_code",
  "quantity_kg",
];

const ATTENDANCE_SAMPLE = [
  {
    report_date: "2026-09-25",
    employee_code: "EMP-101",
    time_preset_label: "Full Day",
    advance_amount: "0",
    section_code: "SEC-A",
    work_type_code: "PLUCKING",
    quantity_kg: "22.5",
  },
  {
    report_date: "2026-09-25",
    employee_code: "EMP-102",
    time_preset_label: "Full Day",
    advance_amount: "200",
    section_code: "SEC-B",
    work_type_code: "WEEDING",
    quantity_kg: "",
  },
];

const SUMMARY_COLUMNS = [
  "report_date",
  "login_available",
  "login_time",
  "logout_available",
  "logout_time",
  "collector_arrived",
  "collector_amount_kg",
  "cash_receive",
  "cash_expenses",
  "cash_description",
  "cash_remarks",
];

const SUMMARY_SAMPLE = [
  {
    report_date: "2026-09-25",
    login_available: "true",
    login_time: "07:15",
    logout_available: "true",
    logout_time: "17:00",
    collector_arrived: "true",
    collector_amount_kg: "180.5",
    cash_receive: "15000",
    cash_expenses: "3200",
    cash_description: "Fuel and supplies",
    cash_remarks: "",
  },
];

function get(headers: string[], cells: string[], key: string) {
  const idx = headers.indexOf(key.toLowerCase());
  return idx === -1 ? "" : (cells[idx] ?? "").trim();
}

function toBool(v: string) {
  return ["true", "1", "yes", "y"].includes(v.toLowerCase());
}

function toNumOrNull(v: string) {
  if (v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function ImportDailyClient() {
  const router = useRouter();

  return (
    <div className="space-y-4">
      <AttendanceImportCard onDone={() => router.refresh()} />
      <SummaryImportCard onDone={() => router.refresh()} />
    </div>
  );
}

function AttendanceImportCard({ onDone }: { onDone: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<AttendanceCsvRow[] | null>(null);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ importedReports: number; importedJobLines: number; errors: string[] } | null>(
    null,
  );

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (inputRef.current) inputRef.current.value = "";
    if (!file) return;
    setResult(null);
    file.text().then((text) => {
      const { headers, rows: cellRows } = parseCsv(text);
      const h = headers.map((x) => x.toLowerCase());
      const errs: string[] = [];
      const parsed: AttendanceCsvRow[] = [];
      cellRows.forEach((cells, i) => {
        const report_date = get(h, cells, "report_date");
        const employee_code = get(h, cells, "employee_code");
        const time_preset_label = get(h, cells, "time_preset_label");
        const section_code = get(h, cells, "section_code");
        const work_type_code = get(h, cells, "work_type_code");
        if (!report_date || !employee_code || !time_preset_label || !section_code || !work_type_code) {
          errs.push(`Row ${i + 2}: missing a required field — skipped.`);
          return;
        }
        parsed.push({
          report_date,
          employee_code,
          time_preset_label,
          advance_amount: toNumOrNull(get(h, cells, "advance_amount")) ?? 0,
          section_code,
          work_type_code,
          quantity_kg: toNumOrNull(get(h, cells, "quantity_kg")),
        });
      });
      setRows(parsed);
      setParseErrors(errs);
    });
  }

  async function handleImport() {
    if (!rows || rows.length === 0) return;
    setImporting(true);
    const res = await importAttendanceRows(rows);
    setImporting(false);
    setResult(res);
    setRows(null);
    if (res.importedReports > 0 || res.importedJobLines > 0) onDone();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Attendance &amp; job lines</CardTitle>
      </CardHeader>
      <CardBody className="space-y-3">
        <p className="text-xs text-slate-500">
          One row per job. Multiple rows with the same date + employee code become one
          worker&apos;s attendance for that day with several job lines. Codes/labels must
          already exist in Employees, Sections, Estate Works and Time Presets.
        </p>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <input
            ref={inputRef}
            type="file"
            accept=".csv"
            onChange={handleFile}
            className="block text-sm text-slate-600"
          />
          <Button
            variant="secondary"
            size="sm"
            onClick={() => downloadCsv(ATTENDANCE_COLUMNS, ATTENDANCE_SAMPLE, "attendance_template.csv")}
          >
            Download template
          </Button>
        </div>

        {parseErrors.length > 0 && (
          <div className="space-y-1 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            {parseErrors.map((e, i) => (
              <p key={i}>{e}</p>
            ))}
          </div>
        )}

        {result && (
          <div className="space-y-1 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            <p>
              Imported {result.importedReports} report{result.importedReports === 1 ? "" : "s"} and{" "}
              {result.importedJobLines} job line{result.importedJobLines === 1 ? "" : "s"}.
            </p>
            {result.errors.length > 0 && (
              <ul className="list-disc pl-4 text-amber-800">
                {result.errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {rows && rows.length > 0 && (
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-slate-500">{rows.length} row(s) parsed and ready.</p>
            <Button size="sm" onClick={handleImport} disabled={importing}>
              {importing ? "Importing…" : `Import ${rows.length} row${rows.length === 1 ? "" : "s"}`}
            </Button>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function SummaryImportCard({ onDone }: { onDone: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<DailySummaryCsvRow[] | null>(null);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ count: number; errors: string[] } | null>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (inputRef.current) inputRef.current.value = "";
    if (!file) return;
    setResult(null);
    file.text().then((text) => {
      const { headers, rows: cellRows } = parseCsv(text);
      const h = headers.map((x) => x.toLowerCase());
      const errs: string[] = [];
      const parsed: DailySummaryCsvRow[] = [];
      cellRows.forEach((cells, i) => {
        const report_date = get(h, cells, "report_date");
        if (!report_date) {
          errs.push(`Row ${i + 2}: missing "report_date" — skipped.`);
          return;
        }
        parsed.push({
          report_date,
          login_available: toBool(get(h, cells, "login_available")),
          login_time: get(h, cells, "login_time") || null,
          logout_available: toBool(get(h, cells, "logout_available")),
          logout_time: get(h, cells, "logout_time") || null,
          collector_arrived: toBool(get(h, cells, "collector_arrived")),
          collector_amount_kg: toNumOrNull(get(h, cells, "collector_amount_kg")),
          cash_receive: toNumOrNull(get(h, cells, "cash_receive")) ?? 0,
          cash_expenses: toNumOrNull(get(h, cells, "cash_expenses")) ?? 0,
          cash_description: get(h, cells, "cash_description") || null,
          cash_remarks: get(h, cells, "cash_remarks") || null,
        });
      });
      setRows(parsed);
      setParseErrors(errs);
    });
  }

  async function handleImport() {
    if (!rows || rows.length === 0) return;
    setImporting(true);
    const res = await importDailySummaryRows(rows);
    setImporting(false);
    setResult(res);
    setRows(null);
    if (res.count > 0) onDone();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Daily summary (transport, tea collector, cash)</CardTitle>
      </CardHeader>
      <CardBody className="space-y-3">
        <p className="text-xs text-slate-500">One row per date.</p>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <input
            ref={inputRef}
            type="file"
            accept=".csv"
            onChange={handleFile}
            className="block text-sm text-slate-600"
          />
          <Button
            variant="secondary"
            size="sm"
            onClick={() => downloadCsv(SUMMARY_COLUMNS, SUMMARY_SAMPLE, "daily_summary_template.csv")}
          >
            Download template
          </Button>
        </div>

        {parseErrors.length > 0 && (
          <div className="space-y-1 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            {parseErrors.map((e, i) => (
              <p key={i}>{e}</p>
            ))}
          </div>
        )}

        {result && (
          <div className="space-y-1 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            <p>Imported {result.count} day(s).</p>
            {result.errors.length > 0 && (
              <ul className="list-disc pl-4 text-amber-800">
                {result.errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {rows && rows.length > 0 && (
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-slate-500">{rows.length} row(s) parsed and ready.</p>
            <Button size="sm" onClick={handleImport} disabled={importing}>
              {importing ? "Importing…" : `Import ${rows.length} row${rows.length === 1 ? "" : "s"}`}
            </Button>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
