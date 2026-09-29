"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { parseCsv, downloadCsv } from "@/lib/csv";
import {
  DAILY_REPORT_CSV_COLUMNS,
  DAILY_REPORT_CSV_SAMPLE_ROWS,
  applyParsedDay,
  buildDailyReportCsvRows,
  parseDailyReportCsv,
  type ParsedDay,
} from "@/lib/daily-report-csv";
import type {
  Attendance,
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

export function DailyReportCsv({
  reportId,
  reportDate,
  isAdmin,
  alreadyCsvImported,
  readOnly,
  employees,
  sections,
  workTypes,
  timePresets,
  attendance,
  transport,
  teaCollector,
  cashSummary,
}: {
  reportId: string;
  reportDate: string;
  isAdmin: boolean;
  alreadyCsvImported: boolean;
  readOnly: boolean;
  employees: Employee[];
  sections: Section[];
  workTypes: WorkType[];
  timePresets: TimePreset[];
  attendance: AttendanceRow[];
  transport: TransportLog;
  teaCollector: TeaCollector;
  cashSummary: CashSummary;
}) {
  const supabase = createClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [day, setDay] = useState<ParsedDay | null>(null);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);

  function handleDownload() {
    const rows = buildDailyReportCsvRows({
      reportDate,
      employees,
      sections,
      workTypes,
      timePresets,
      attendance,
      transport,
      teaCollector,
      cashSummary,
    });
    downloadCsv([...DAILY_REPORT_CSV_COLUMNS], rows, `daily_report_${reportDate}.csv`);
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (inputRef.current) inputRef.current.value = "";
    if (!file) return;
    setApplyError(null);
    setDay(null);
    file.text().then((text) => {
      const { headers, rows } = parseCsv(text);
      const { days, errors } = parseDailyReportCsv(
        headers.map((h) => h.toLowerCase()),
        rows,
        { employees, sections, workTypes, timePresets },
      );

      const errs = [...errors];
      const otherDates = Array.from(days.keys()).filter((d) => d !== reportDate);
      if (otherDates.length > 0) {
        errs.push(
          `Ignored rows for ${otherDates.join(", ")} — this uploads only ${reportDate}.`,
        );
      }

      const matchedDay = days.get(reportDate) ?? null;
      if (!matchedDay) {
        errs.push(`No rows found for ${reportDate}.`);
      }
      setDay(matchedDay);
      setParseErrors(errs);
    });
  }

  async function handleApply() {
    if (!day) return;
    const confirmed = window.confirm(
      `This replaces ALL of ${reportDate}'s existing attendance, jobs, transport, tea collector and cash summary with what's in this file. Continue?`,
    );
    if (!confirmed) return;

    setApplying(true);
    setApplyError(null);
    const { error } = await applyParsedDay(supabase, reportId, day);
    setApplying(false);
    if (error) {
      setApplyError(error);
      return;
    }
    window.location.reload();
  }

  const canUpload = !readOnly && (isAdmin || !alreadyCsvImported);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">CSV</CardTitle>
      </CardHeader>
      <CardBody className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={handleDownload}>
            Download {reportDate}.csv
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              downloadCsv(
                [...DAILY_REPORT_CSV_COLUMNS],
                DAILY_REPORT_CSV_SAMPLE_ROWS,
                "daily_report_template.csv",
              )
            }
          >
            Download template
          </Button>
        </div>

        {canUpload ? (
          <>
            <p className="text-xs text-slate-500">
              One row per job. Fill in employee codes exactly as they appear in Admin →
              Employees (e.g. &quot;f1&quot;) — the name column is for your reference only and
              isn&apos;t checked. Uploading replaces all of {reportDate}&apos;s data.
              {!isAdmin && " You can only do this once per day."}
            </p>
            <input
              ref={inputRef}
              type="file"
              accept=".csv"
              onChange={handleFile}
              className="block w-full text-sm text-slate-600"
            />
          </>
        ) : (
          !readOnly && (
            <p className="rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-600">
              You&apos;ve already uploaded a CSV for today. Ask an admin if you need further
              bulk changes.
            </p>
          )
        )}

        {parseErrors.length > 0 && (
          <div className="space-y-1 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            {parseErrors.map((e, i) => (
              <p key={i}>{e}</p>
            ))}
          </div>
        )}

        {applyError && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{applyError}</p>
        )}

        {day && (
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-slate-500">
              {day.employees.size} worker{day.employees.size === 1 ? "" : "s"} ready to import
              for {reportDate}.
            </p>
            <Button size="sm" onClick={handleApply} disabled={applying}>
              {applying ? "Importing…" : "Overwrite with this file"}
            </Button>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
