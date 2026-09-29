import type { SupabaseClient } from "@supabase/supabase-js";
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

// One row per job line. Day-level fields (transport/tea collector/cash
// summary) only need a value on the file's first data row — they describe
// the whole day, not a single worker, so they're read once and ignored on
// every other row.
export const DAILY_REPORT_CSV_COLUMNS = [
  "date",
  "employee_code",
  "employee_name",
  "start_time",
  "end_time",
  "section_code",
  "work_type_code",
  "quantity_kg",
  "advance_amount",
  "transport_login",
  "transport_login_time",
  "transport_logout",
  "transport_logout_time",
  "collector_arrived",
  "collector_amount_kg",
  "cash_receive",
  "cash_expenses",
  "cash_description",
  "cash_remarks",
] as const;

type AttendanceRow = Attendance & { job_lines: JobLine[] };

function hhmm(t: string | null | undefined): string {
  return t ? t.slice(0, 5) : "";
}

/** Builds the CSV rows for a single day's already-entered data — used for
 * both "download today's data" and, by an admin, exporting any past date to
 * edit and re-upload. */
export function buildDailyReportCsvRows({
  reportDate,
  employees,
  sections,
  workTypes,
  timePresets,
  attendance,
  transport,
  teaCollector,
  cashSummary,
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
}): Record<string, string | number | boolean> [] {
  const employeeById = new Map(employees.map((e) => [e.id, e]));
  const sectionById = new Map(sections.map((s) => [s.id, s]));
  const workTypeById = new Map(workTypes.map((w) => [w.id, w]));
  const timePresetById = new Map(timePresets.map((t) => [t.id, t]));

  const summaryColumns = {
    transport_login: transport?.login_available ?? false,
    transport_login_time: hhmm(transport?.login_time),
    transport_logout: transport?.logout_available ?? false,
    transport_logout_time: hhmm(transport?.logout_time),
    collector_arrived: teaCollector?.arrived ?? false,
    collector_amount_kg: teaCollector?.amount_kg ?? "",
    cash_receive: cashSummary?.receive ?? "",
    cash_expenses: cashSummary?.expenses ?? "",
    cash_description: cashSummary?.description ?? "",
    cash_remarks: cashSummary?.remarks ?? "",
  };
  const blankSummaryColumns = {
    transport_login: "",
    transport_login_time: "",
    transport_logout: "",
    transport_logout_time: "",
    collector_arrived: "",
    collector_amount_kg: "",
    cash_receive: "",
    cash_expenses: "",
    cash_description: "",
    cash_remarks: "",
  };

  const rows: Record<string, string | number | boolean>[] = [];
  let isFirstRow = true;

  for (const a of attendance) {
    const employee = employeeById.get(a.employee_id);
    const tp = timePresetById.get(a.time_preset_id);
    const lines = a.job_lines.length > 0 ? a.job_lines : [null];

    for (const jl of lines) {
      const section = jl ? sectionById.get(jl.section_id) : undefined;
      const workType = jl ? workTypeById.get(jl.work_type_id) : undefined;
      rows.push({
        date: reportDate,
        employee_code: employee?.code ?? "",
        employee_name: employee?.name ?? "",
        start_time: hhmm(tp?.start_time),
        end_time: hhmm(tp?.end_time),
        section_code: section?.code ?? "",
        work_type_code: workType?.code ?? "",
        quantity_kg: jl?.quantity_kg ?? "",
        advance_amount: a.advance_amount ?? 0,
        ...(isFirstRow ? summaryColumns : blankSummaryColumns),
      });
      isFirstRow = false;
    }
  }

  if (rows.length === 0) {
    rows.push({
      date: reportDate,
      employee_code: "",
      employee_name: "",
      start_time: "",
      end_time: "",
      section_code: "",
      work_type_code: "",
      quantity_kg: "",
      advance_amount: "",
      ...summaryColumns,
    });
  }

  return rows;
}

export const DAILY_REPORT_CSV_SAMPLE_ROWS = [
  {
    date: "2026-09-25",
    employee_code: "m1",
    employee_name: "Kokila",
    start_time: "07:30",
    end_time: "13:30",
    section_code: "1D",
    work_type_code: "Tea_Plucking",
    quantity_kg: "18",
    advance_amount: "500",
    transport_login: "true",
    transport_login_time: "07:15",
    transport_logout: "true",
    transport_logout_time: "17:00",
    collector_arrived: "true",
    collector_amount_kg: "180.5",
    cash_receive: "15000",
    cash_expenses: "3200",
    cash_description: "Fuel and supplies",
    cash_remarks: "",
  },
  {
    date: "2026-09-25",
    employee_code: "m1",
    employee_name: "Kokila",
    start_time: "07:30",
    end_time: "13:30",
    section_code: "1B3",
    work_type_code: "Tea_Weeding",
    quantity_kg: "",
    advance_amount: "",
    transport_login: "",
    transport_login_time: "",
    transport_logout: "",
    transport_logout_time: "",
    collector_arrived: "",
    collector_amount_kg: "",
    cash_receive: "",
    cash_expenses: "",
    cash_description: "",
    cash_remarks: "",
  },
];

// ---- Parsing / validation for upload ----

export type ParsedJobLine = {
  sectionId: string;
  workTypeId: string;
  quantityKg: number | null;
};

export type ParsedEmployeeDay = {
  employeeId: string;
  employeeCode: string;
  timePresetId: string;
  advanceAmount: number;
  jobLines: ParsedJobLine[];
};

export type ParsedDailySummary = {
  loginAvailable: boolean;
  loginTime: string | null;
  logoutAvailable: boolean;
  logoutTime: string | null;
  collectorArrived: boolean;
  collectorAmountKg: number | null;
  cashReceive: number;
  cashExpenses: number;
  cashDescription: string | null;
  cashRemarks: string | null;
};

export type ParsedDay = {
  date: string;
  employees: Map<string, ParsedEmployeeDay>;
  summary: ParsedDailySummary;
};

function toBool(v: string): boolean {
  return ["true", "1", "yes", "y"].includes(v.trim().toLowerCase());
}

function toNumOrNull(v: string): number | null {
  const t = v.trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function get(headers: string[], cells: string[], key: string): string {
  const idx = headers.indexOf(key);
  return idx === -1 ? "" : (cells[idx] ?? "").trim();
}

/** Parses and validates the daily-report CSV format against the estate's
 * current master data. Matching is by code/time only — a mistyped
 * employee_name is never checked against employee_code, by design; the code
 * is the only thing that has to be right. */
export function parseDailyReportCsv(
  headers: string[],
  cellRows: string[][],
  lookups: {
    employees: Employee[];
    sections: Section[];
    workTypes: WorkType[];
    timePresets: TimePreset[];
  },
): { days: Map<string, ParsedDay>; errors: string[] } {
  const h = headers.map((x) => x.toLowerCase());
  const employeeByCode = new Map(lookups.employees.map((e) => [e.code.toLowerCase(), e]));
  const sectionByCode = new Map(lookups.sections.map((s) => [s.code.toLowerCase(), s]));
  const workTypeByCode = new Map(lookups.workTypes.map((w) => [w.code.toLowerCase(), w]));
  const timePresetByRange = new Map(
    lookups.timePresets.map((t) => [`${hhmm(t.start_time)}-${hhmm(t.end_time)}`, t]),
  );

  const errors: string[] = [];
  const days = new Map<string, ParsedDay>();

  cellRows.forEach((cells, i) => {
    const rowNum = i + 2;
    const date = get(h, cells, "date");
    const employeeCode = get(h, cells, "employee_code");
    const startTime = get(h, cells, "start_time");
    const endTime = get(h, cells, "end_time");
    const sectionCode = get(h, cells, "section_code");
    const workTypeCode = get(h, cells, "work_type_code");

    if (!date || !employeeCode || !startTime || !endTime) {
      errors.push(`Row ${rowNum}: missing date, employee_code, start_time or end_time — skipped.`);
      return;
    }
    const employee = employeeByCode.get(employeeCode.toLowerCase());
    if (!employee) {
      errors.push(`Row ${rowNum}: unknown employee code "${employeeCode}".`);
      return;
    }
    const timePreset = timePresetByRange.get(`${startTime}-${endTime}`);
    if (!timePreset) {
      errors.push(`Row ${rowNum}: no time preset matches ${startTime}–${endTime}.`);
      return;
    }

    let jobLine: ParsedJobLine | null = null;
    if (sectionCode || workTypeCode) {
      const section = sectionByCode.get(sectionCode.toLowerCase());
      const workType = workTypeByCode.get(workTypeCode.toLowerCase());
      if (!section) {
        errors.push(`Row ${rowNum}: unknown section code "${sectionCode}".`);
        return;
      }
      if (!workType) {
        errors.push(`Row ${rowNum}: unknown estate work "${workTypeCode}".`);
        return;
      }
      jobLine = {
        sectionId: section.id,
        workTypeId: workType.id,
        quantityKg: toNumOrNull(get(h, cells, "quantity_kg")),
      };
    }

    let day = days.get(date);
    if (!day) {
      day = {
        date,
        employees: new Map(),
        summary: {
          loginAvailable: toBool(get(h, cells, "transport_login")),
          loginTime: get(h, cells, "transport_login_time") || null,
          logoutAvailable: toBool(get(h, cells, "transport_logout")),
          logoutTime: get(h, cells, "transport_logout_time") || null,
          collectorArrived: toBool(get(h, cells, "collector_arrived")),
          collectorAmountKg: toNumOrNull(get(h, cells, "collector_amount_kg")),
          cashReceive: toNumOrNull(get(h, cells, "cash_receive")) ?? 0,
          cashExpenses: toNumOrNull(get(h, cells, "cash_expenses")) ?? 0,
          cashDescription: get(h, cells, "cash_description") || null,
          cashRemarks: get(h, cells, "cash_remarks") || null,
        },
      };
      days.set(date, day);
    }

    let empDay = day.employees.get(employee.id);
    if (!empDay) {
      empDay = {
        employeeId: employee.id,
        employeeCode: employee.code,
        timePresetId: timePreset.id,
        advanceAmount: toNumOrNull(get(h, cells, "advance_amount")) ?? 0,
        jobLines: [],
      };
      day.employees.set(employee.id, empDay);
    }
    if (jobLine) empDay.jobLines.push(jobLine);
  });

  return { days, errors };
}

/** Fully replaces a report's attendance/job lines/transport/tea
 * collector/cash summary with what's in `day` — a re-upload always
 * overwrites, it never merges with what was there before. Runs through the
 * normal (RLS-bound) client, so the same "today + draft, or admin" rule that
 * governs manual edits governs this too — no separate permission check
 * needed here. */
export async function applyParsedDay(
  supabase: SupabaseClient,
  reportId: string,
  day: ParsedDay,
): Promise<{ error: string | null }> {
  const { error: delError } = await supabase
    .from("attendance")
    .delete()
    .eq("daily_report_id", reportId);
  if (delError) return { error: delError.message };

  const employeeDays = Array.from(day.employees.values());
  if (employeeDays.length > 0) {
    const { data: inserted, error: attError } = await supabase
      .from("attendance")
      .insert(
        employeeDays.map((e) => ({
          daily_report_id: reportId,
          employee_id: e.employeeId,
          time_preset_id: e.timePresetId,
          advance_amount: e.advanceAmount,
        })),
      )
      .select("id, employee_id");
    if (attError) return { error: attError.message };

    const attendanceIdByEmployee = new Map(
      (inserted ?? []).map((a) => [a.employee_id as string, a.id as string]),
    );
    const jobLinesToInsert = employeeDays.flatMap((e) => {
      const attendanceId = attendanceIdByEmployee.get(e.employeeId);
      if (!attendanceId) return [];
      return e.jobLines.map((jl) => ({
        attendance_id: attendanceId,
        section_id: jl.sectionId,
        work_type_id: jl.workTypeId,
        quantity_kg: jl.quantityKg,
      }));
    });
    if (jobLinesToInsert.length > 0) {
      const { error: jlError } = await supabase.from("job_lines").insert(jobLinesToInsert);
      if (jlError) return { error: jlError.message };
    }
  }

  const s = day.summary;
  const [transportRes, collectorRes, cashRes] = await Promise.all([
    supabase.from("transport_log").upsert(
      {
        daily_report_id: reportId,
        login_available: s.loginAvailable,
        login_time: s.loginTime,
        logout_available: s.logoutAvailable,
        logout_time: s.logoutTime,
      },
      { onConflict: "daily_report_id" },
    ),
    supabase.from("tea_collector").upsert(
      {
        daily_report_id: reportId,
        arrived: s.collectorArrived,
        amount_kg: s.collectorAmountKg,
      },
      { onConflict: "daily_report_id" },
    ),
    supabase.from("cash_summary").upsert(
      {
        daily_report_id: reportId,
        receive: s.cashReceive,
        expenses: s.cashExpenses,
        balance: s.cashReceive - s.cashExpenses,
        description: s.cashDescription,
        remarks: s.cashRemarks,
      },
      { onConflict: "daily_report_id" },
    ),
  ]);
  const summaryError = transportRes.error ?? collectorRes.error ?? cashRes.error;
  if (summaryError) return { error: summaryError.message };

  // Keep the itemized cash_entries in step with the totals this upload just
  // set — the CSV only carries one receive/expense figure, so it becomes a
  // single "Imported via CSV" entry on each side rather than being lost.
  const { error: cashEntriesDelError } = await supabase
    .from("cash_entries")
    .delete()
    .eq("daily_report_id", reportId);
  if (cashEntriesDelError) return { error: cashEntriesDelError.message };

  const newCashEntries = [
    s.cashReceive > 0
      ? { daily_report_id: reportId, type: "income", reason: "Imported via CSV", amount: s.cashReceive }
      : null,
    s.cashExpenses > 0
      ? { daily_report_id: reportId, type: "expense", reason: "Imported via CSV", amount: s.cashExpenses }
      : null,
  ].filter((e): e is NonNullable<typeof e> => e !== null);
  if (newCashEntries.length > 0) {
    const { error: cashEntriesInsError } = await supabase.from("cash_entries").insert(newCashEntries);
    if (cashEntriesInsError) return { error: cashEntriesInsError.message };
  }

  const { error: reportError } = await supabase
    .from("daily_reports")
    .update({
      csv_imported_at: new Date().toISOString(),
      last_amended_at: new Date().toISOString(),
    })
    .eq("id", reportId);
  if (reportError) return { error: reportError.message };

  return { error: null };
}
