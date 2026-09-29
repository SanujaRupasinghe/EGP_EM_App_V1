"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn, formatDate, formatLKR } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { DailyReportPdfButton } from "@/components/entry/daily-report-pdf-button";
import { DailyReportCsv } from "@/components/entry/daily-report-csv";
import type {
  Attendance,
  CashEntry,
  CashSummary,
  DailyReport,
  Employee,
  JobLine,
  Section,
  TeaCollector,
  TimePreset,
  TransportLog,
  WorkType,
} from "@/lib/supabase/types";

const INCOME_REASON_SUGGESTIONS = ["From bank", "From tea collector"];
const EXPENSE_REASON_SUGGESTIONS = ["Advance payment", "Loan given", "Groceries", "Small items"];

type AttendanceRow = Attendance & { job_lines: JobLine[] };

export function EntryForm({
  reportId,
  reportDate,
  status,
  readOnly,
  isAdmin,
  employees,
  sections,
  workTypes,
  timePresets,
  initialAttendance,
  initialTransport,
  initialTeaCollector,
  initialCashSummary,
  initialCashEntries,
  broughtForward,
  amendmentCount,
  lastAmendedAt,
}: {
  reportId: string;
  reportDate: string;
  status: DailyReport["status"];
  readOnly: boolean;
  isAdmin: boolean;
  employees: Employee[];
  sections: Section[];
  workTypes: WorkType[];
  timePresets: TimePreset[];
  initialAttendance: AttendanceRow[];
  initialTransport: TransportLog | null;
  initialTeaCollector: TeaCollector | null;
  initialCashSummary: CashSummary | null;
  initialCashEntries: CashEntry[];
  /** Previous day's closing cash balance, carried forward as today's
   * starting point (like a paper cash book) — computed server-side once per
   * page load, not editable here. */
  broughtForward: number;
  amendmentCount: number;
  lastAmendedAt: string | null;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [attendance, setAttendance] = useState<AttendanceRow[]>(initialAttendance);
  const [transport, setTransport] = useState<TransportLog>(
    initialTransport ?? {
      daily_report_id: reportId,
      login_available: false,
      login_time: null,
      logout_available: false,
      logout_time: null,
    },
  );
  const [teaCollector, setTeaCollector] = useState<TeaCollector>(
    initialTeaCollector ?? { daily_report_id: reportId, arrived: false, amount_kg: null },
  );
  const [cashSummary, setCashSummary] = useState<CashSummary>(
    initialCashSummary ?? {
      daily_report_id: reportId,
      receive: 0,
      expenses: 0,
      balance: 0,
      description: "",
      remarks: "",
    },
  );
  const [cashEntries, setCashEntries] = useState<CashEntry[]>(initialCashEntries);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saveCount, setSaveCount] = useState(amendmentCount);
  const [submitting, setSubmitting] = useState(false);
  const [addingWorkers, setAddingWorkers] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);

  const availableEmployees = useMemo(
    () => employees.filter((e) => !attendance.some((a) => a.employee_id === e.id)),
    [employees, attendance],
  );

  const filteredAvailable = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return availableEmployees;
    return availableEmployees.filter(
      (e) => e.code.toLowerCase().includes(q) || e.name.toLowerCase().includes(q),
    );
  }, [availableEmployees, search]);

  const totalAdvances = useMemo(
    () => attendance.reduce((sum, a) => sum + Number(a.advance_amount || 0), 0),
    [attendance],
  );

  const totalKg = useMemo(
    () =>
      attendance.reduce(
        (sum, a) => sum + a.job_lines.reduce((s, jl) => s + Number(jl.quantity_kg ?? 0), 0),
        0,
      ),
    [attendance],
  );

  const incomeEntries = useMemo(
    () => cashEntries.filter((e) => e.type === "income"),
    [cashEntries],
  );
  const expenseEntries = useMemo(
    () => cashEntries.filter((e) => e.type === "expense"),
    [cashEntries],
  );
  const hasAdvancePaymentEntry = expenseEntries.some((e) => e.reason === "Advance payment");

  // Computed live from state rather than trusting the stored cash_summary
  // row, so it's always correct even before the first edit of the session
  // (e.g. a report saved before brought-forward existed, or before any
  // entry has triggered a resave).
  const cashBalance = broughtForward + cashSummary.receive - cashSummary.expenses;

  function handleError(err: { message?: string } | null) {
    if (!err) return;
    const msg = err.message ?? "Something went wrong.";
    if (msg.toLowerCase().includes("row-level security")) {
      setError(
        "This day has closed for editing (it's no longer today). Refresh the page to start today's report.",
      );
    } else {
      setError(msg);
    }
  }

  async function touchReport() {
    // Setting last_amended_at to "now" guarantees the row actually changes on every
    // call, which is what fires the trg_bump_amendment trigger (it only runs when
    // the row is distinct from before) — the trigger then overwrites this value
    // with the authoritative server-side timestamp and increments amendment_count.
    const { error } = await supabase
      .from("daily_reports")
      .update({ last_amended_at: new Date().toISOString() })
      .eq("id", reportId);
    if (!error) setSaveCount((c) => c + 1);
    handleError(error);
  }

  function toggleChecked(id: string) {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllVisible(checked: boolean) {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      for (const e of filteredAvailable) {
        if (checked) next.add(e.id);
        else next.delete(e.id);
      }
      return next;
    });
  }

  async function addSelectedWorkers() {
    if (checkedIds.size === 0 || readOnly) return;
    setError(null);
    setAddingWorkers(true);

    const defaultPreset = timePresets[0];
    const attendanceToInsert = Array.from(checkedIds).map((employee_id) => ({
      daily_report_id: reportId,
      employee_id,
      time_preset_id: defaultPreset?.id,
      advance_amount: 0,
    }));

    const { data: newAttendance, error: attError } = await supabase
      .from("attendance")
      .insert(attendanceToInsert)
      .select();
    if (attError) {
      setAddingWorkers(false);
      return handleError(attError);
    }

    const jobLinesToInsert = (newAttendance as Attendance[]).map((a) => ({
      attendance_id: a.id,
      section_id: sections[0]?.id,
      work_type_id: workTypes[0]?.id,
      quantity_kg: null,
    }));
    const { data: newJobLines, error: jlError } = await supabase
      .from("job_lines")
      .insert(jobLinesToInsert)
      .select();
    setAddingWorkers(false);
    if (jlError) return handleError(jlError);

    const jobLinesByAttendance = new Map<string, JobLine[]>();
    for (const jl of newJobLines as JobLine[]) {
      const list = jobLinesByAttendance.get(jl.attendance_id) ?? [];
      list.push(jl);
      jobLinesByAttendance.set(jl.attendance_id, list);
    }

    setAttendance((rows) => [
      ...rows,
      ...(newAttendance as Attendance[]).map((a) => ({
        ...a,
        job_lines: jobLinesByAttendance.get(a.id) ?? [],
      })),
    ]);
    setCheckedIds(new Set());
    setSearch("");
    await touchReport();
  }

  async function removeEmployee(attendanceId: string) {
    setError(null);
    const { error } = await supabase.from("attendance").delete().eq("id", attendanceId);
    if (error) return handleError(error);
    setAttendance((rows) => rows.filter((r) => r.id !== attendanceId));
    await touchReport();
  }

  async function updateAttendance(attendanceId: string, patch: Partial<Attendance>) {
    setAttendance((rows) =>
      rows.map((r) => (r.id === attendanceId ? { ...r, ...patch } : r)),
    );
    const { error } = await supabase.from("attendance").update(patch).eq("id", attendanceId);
    if (error) return handleError(error);
    await touchReport();
  }

  async function addJobLine(attendanceId: string) {
    setError(null);
    const { data, error } = await supabase
      .from("job_lines")
      .insert({
        attendance_id: attendanceId,
        section_id: sections[0]?.id,
        work_type_id: workTypes[0]?.id,
        quantity_kg: null,
      })
      .select()
      .single();
    if (error) return handleError(error);
    setAttendance((rows) =>
      rows.map((r) =>
        r.id === attendanceId
          ? { ...r, job_lines: [...r.job_lines, data as JobLine] }
          : r,
      ),
    );
    await touchReport();
  }

  async function updateJobLine(
    attendanceId: string,
    jobLineId: string,
    patch: Partial<JobLine>,
  ) {
    setAttendance((rows) =>
      rows.map((r) =>
        r.id === attendanceId
          ? {
              ...r,
              job_lines: r.job_lines.map((jl) =>
                jl.id === jobLineId ? { ...jl, ...patch } : jl,
              ),
            }
          : r,
      ),
    );
    const { error } = await supabase.from("job_lines").update(patch).eq("id", jobLineId);
    if (error) return handleError(error);
    await touchReport();
  }

  async function removeJobLine(attendanceId: string, jobLineId: string) {
    setError(null);
    const { error } = await supabase.from("job_lines").delete().eq("id", jobLineId);
    if (error) return handleError(error);
    setAttendance((rows) =>
      rows.map((r) =>
        r.id === attendanceId
          ? { ...r, job_lines: r.job_lines.filter((jl) => jl.id !== jobLineId) }
          : r,
      ),
    );
    await touchReport();
  }

  async function saveTransport(patch: Partial<TransportLog>) {
    const next = { ...transport, ...patch };
    setTransport(next);
    const { error } = await supabase
      .from("transport_log")
      .upsert({ ...next, daily_report_id: reportId }, { onConflict: "daily_report_id" });
    if (error) return handleError(error);
    await touchReport();
  }

  async function saveTeaCollector(patch: Partial<TeaCollector>) {
    const next = { ...teaCollector, ...patch };
    setTeaCollector(next);
    const { error } = await supabase
      .from("tea_collector")
      .upsert({ ...next, daily_report_id: reportId }, { onConflict: "daily_report_id" });
    if (error) return handleError(error);
    await touchReport();
  }

  async function saveCashSummary(patch: Partial<CashSummary>) {
    const next = { ...cashSummary, ...patch };
    setCashSummary(next);
    const { error } = await supabase
      .from("cash_summary")
      .upsert({ ...next, daily_report_id: reportId }, { onConflict: "daily_report_id" });
    if (error) return handleError(error);
    await touchReport();
  }

  // cash_summary.receive/expenses/balance are totals derived from the
  // itemized cash_entries rows — recomputed and saved every time an entry
  // changes, so nothing else that reads cash_summary (print, dashboard,
  // CSV) needs to know entries exist at all.
  async function syncCashTotals(entries: CashEntry[]) {
    const receive = entries
      .filter((e) => e.type === "income")
      .reduce((sum, e) => sum + Number(e.amount || 0), 0);
    const expenses = entries
      .filter((e) => e.type === "expense")
      .reduce((sum, e) => sum + Number(e.amount || 0), 0);
    await saveCashSummary({ receive, expenses, balance: broughtForward + receive - expenses });
  }

  async function addCashEntry(type: CashEntry["type"], reason = "", amount = 0) {
    if (readOnly) return;
    setError(null);
    const { data, error } = await supabase
      .from("cash_entries")
      .insert({ daily_report_id: reportId, type, reason, amount })
      .select()
      .single();
    if (error) return handleError(error);
    const next = [...cashEntries, data as CashEntry];
    setCashEntries(next);
    await syncCashTotals(next);
  }

  async function updateCashEntry(id: string, patch: Partial<CashEntry>) {
    const next = cashEntries.map((e) => (e.id === id ? { ...e, ...patch } : e));
    setCashEntries(next);
    const { error } = await supabase.from("cash_entries").update(patch).eq("id", id);
    if (error) return handleError(error);
    await syncCashTotals(next);
  }

  async function removeCashEntry(id: string) {
    setError(null);
    const { error } = await supabase.from("cash_entries").delete().eq("id", id);
    if (error) return handleError(error);
    const next = cashEntries.filter((e) => e.id !== id);
    setCashEntries(next);
    await syncCashTotals(next);
  }

  async function handleClearAll() {
    if (
      attendance.length === 0 &&
      !transport.login_available &&
      !transport.logout_available &&
      !teaCollector.arrived &&
      !teaCollector.amount_kg &&
      cashEntries.length === 0 &&
      !cashSummary.remarks
    ) {
      return;
    }
    const confirmed = window.confirm(
      "Clear everything entered for today? This removes every worker, job, transport, tea collector and cash entry — it can't be undone.",
    );
    if (!confirmed) return;

    setClearing(true);
    setError(null);

    const [attRes, cashEntriesRes] = await Promise.all([
      supabase.from("attendance").delete().eq("daily_report_id", reportId),
      supabase.from("cash_entries").delete().eq("daily_report_id", reportId),
    ]);
    const deleteError = attRes.error ?? cashEntriesRes.error;
    if (deleteError) {
      setClearing(false);
      return handleError(deleteError);
    }

    const blankTransport: TransportLog = {
      daily_report_id: reportId,
      login_available: false,
      login_time: null,
      logout_available: false,
      logout_time: null,
    };
    const blankTeaCollector: TeaCollector = {
      daily_report_id: reportId,
      arrived: false,
      amount_kg: null,
    };
    const blankCashSummary: CashSummary = {
      daily_report_id: reportId,
      receive: 0,
      expenses: 0,
      balance: broughtForward,
      description: "",
      remarks: "",
    };

    const [transportRes, collectorRes, cashRes] = await Promise.all([
      supabase
        .from("transport_log")
        .upsert(blankTransport, { onConflict: "daily_report_id" }),
      supabase
        .from("tea_collector")
        .upsert(blankTeaCollector, { onConflict: "daily_report_id" }),
      supabase
        .from("cash_summary")
        .upsert(blankCashSummary, { onConflict: "daily_report_id" }),
    ]);
    const summaryError = transportRes.error ?? collectorRes.error ?? cashRes.error;
    if (summaryError) {
      setClearing(false);
      return handleError(summaryError);
    }

    await supabase
      .from("daily_reports")
      .update({ csv_imported_at: null })
      .eq("id", reportId);

    setAttendance([]);
    setTransport(blankTransport);
    setTeaCollector(blankTeaCollector);
    setCashSummary(blankCashSummary);
    setCashEntries([]);
    setClearing(false);
    await touchReport();
  }

  async function handleSubmitDay() {
    if (attendance.length === 0) {
      setError("Add at least one worker before submitting.");
      return;
    }
    const confirmed = window.confirm(
      "Submit this report? Double-check the entries above — once submitted, it moves to History and you won't be able to edit it unless an admin unlocks it.",
    );
    if (!confirmed) return;

    setSubmitting(true);
    setError(null);
    const { error } = await supabase
      .from("daily_reports")
      .update({ status: "finalized" })
      .eq("id", reportId);
    setSubmitting(false);
    if (error) return handleError(error);

    router.push(`/history?date=${reportDate}`);
    router.refresh();
  }

  // Field edits already autosave on blur/change, but admins correcting an
  // already-submitted (finalized) day get no other confirmation that a
  // correction went through — this just bumps the amendment trail and gives
  // a visible "Saved" acknowledgement instead of a silent no-op.
  async function handleSaveChanges() {
    setSubmitting(true);
    setError(null);
    await touchReport();
    setSubmitting(false);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2500);
    router.refresh();
  }

  const allVisibleChecked =
    filteredAvailable.length > 0 && filteredAvailable.every((e) => checkedIds.has(e.id));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">{formatDate(reportDate)}</h1>
          <p className="text-xs text-slate-500">
            {saveCount > 0
              ? `Amended ${saveCount} time${saveCount === 1 ? "" : "s"}${lastAmendedAt ? ` · last ${new Date(lastAmendedAt).toLocaleTimeString("en-LK")}` : ""}`
              : "Not saved yet today"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DailyReportPdfButton
            reportDate={reportDate}
            employees={employees}
            sections={sections}
            workTypes={workTypes}
            timePresets={timePresets}
            attendance={attendance}
            transport={transport}
            teaCollector={teaCollector}
            cashSummary={cashSummary}
            cashEntries={cashEntries}
            broughtForward={broughtForward}
          />
          {!readOnly && (
            <Button
              variant="danger"
              size="sm"
              onClick={handleClearAll}
              disabled={clearing}
            >
              {clearing ? "Clearing…" : "Clear all"}
            </Button>
          )}
          {status === "finalized" ? (
            <Badge tone="green">Submitted</Badge>
          ) : (
            readOnly && <Badge tone="slate">Read-only</Badge>
          )}
        </div>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {isAdmin && (
        <DailyReportCsv
          reportId={reportId}
          reportDate={reportDate}
          employees={employees}
          sections={sections}
          workTypes={workTypes}
          timePresets={timePresets}
          attendance={attendance}
          transport={transport}
          teaCollector={teaCollector}
          cashSummary={cashSummary}
        />
      )}

      {!readOnly && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">
              Step 1 · Tick who&apos;s here today
              {checkedIds.size > 0 && (
                <span className="ml-2 font-normal text-slate-500">
                  ({checkedIds.size} selected)
                </span>
              )}
            </CardTitle>
            <Button size="sm" onClick={addSelectedWorkers} disabled={checkedIds.size === 0 || addingWorkers}>
              {addingWorkers
                ? "Adding…"
                : `Add ${checkedIds.size || ""} worker${checkedIds.size === 1 ? "" : "s"}`}
            </Button>
          </CardHeader>
          <CardBody className="space-y-3">
            {availableEmployees.length === 0 ? (
              <p className="text-sm text-slate-500">Every active worker has already been added below.</p>
            ) : (
              <>
                <Input
                  placeholder="Search by code or name…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <label className="flex items-center gap-2 text-xs font-medium text-slate-500">
                  <input
                    type="checkbox"
                    checked={allVisibleChecked}
                    onChange={(e) => toggleAllVisible(e.target.checked)}
                  />
                  Select all ({filteredAvailable.length})
                </label>
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                  {filteredAvailable.map((e) => {
                    const checked = checkedIds.has(e.id);
                    return (
                      <label
                        key={e.id}
                        className={cn(
                          "flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm transition-colors",
                          checked
                            ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                            : "border-slate-200 hover:bg-slate-50",
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleChecked(e.id)}
                        />
                        <span className="truncate">
                          {e.code} — {e.name}
                        </span>
                      </label>
                    );
                  })}
                  {filteredAvailable.length === 0 && (
                    <p className="col-span-full text-sm text-slate-400">No match.</p>
                  )}
                </div>
              </>
            )}
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">
            Step 2 · Attendance {attendance.length > 0 && `(${attendance.length})`}
          </CardTitle>
        </CardHeader>
        {attendance.length === 0 ? (
          <CardBody>
            <p className="text-sm text-slate-500">
              {readOnly
                ? "No workers were recorded for this day."
                : "No workers added yet — tick workers above and click Add."}
            </p>
          </CardBody>
        ) : (
          <CardBody className="overflow-x-auto p-0">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
                  <th className="sticky left-0 z-10 bg-slate-50 px-3 py-2 font-medium">Worker</th>
                  <th className="px-3 py-2 font-medium">Time</th>
                  <th className="px-3 py-2 font-medium">Jobs (section · work · kg)</th>
                  <th className="px-3 py-2 font-medium">Advance (LKR)</th>
                  {!readOnly && <th className="px-3 py-2" />}
                </tr>
              </thead>
              <tbody>
                {attendance.map((row) => {
                  const employee = employees.find((e) => e.id === row.employee_id);
                  return (
                    <tr key={row.id} className="border-b border-slate-100 align-top">
                      <td className="sticky left-0 z-10 whitespace-nowrap bg-white px-3 py-2 font-medium text-slate-900">
                        {employee?.code} — {employee?.name}
                      </td>
                      <td className="px-3 py-2">
                        <Select
                          className="h-9 min-w-40"
                          value={row.time_preset_id}
                          disabled={readOnly}
                          onChange={(e) =>
                            updateAttendance(row.id, { time_preset_id: e.target.value })
                          }
                        >
                          {timePresets.map((tp) => (
                            <option key={tp.id} value={tp.id}>
                              {tp.label}
                            </option>
                          ))}
                        </Select>
                      </td>
                      <td className="px-3 py-2">
                        <div className="space-y-1.5">
                          {row.job_lines.map((jl) => {
                            const workType = workTypes.find((w) => w.id === jl.work_type_id);
                            return (
                              <div key={jl.id} className="flex flex-wrap items-center gap-1.5">
                                <Select
                                  className="h-8 w-24"
                                  value={jl.section_id}
                                  disabled={readOnly}
                                  onChange={(e) =>
                                    updateJobLine(row.id, jl.id, { section_id: e.target.value })
                                  }
                                >
                                  {sections.map((s) => (
                                    <option key={s.id} value={s.id}>
                                      {s.code}
                                    </option>
                                  ))}
                                </Select>
                                <Select
                                  className="h-8 w-32"
                                  value={jl.work_type_id}
                                  disabled={readOnly}
                                  onChange={(e) =>
                                    updateJobLine(row.id, jl.id, { work_type_id: e.target.value })
                                  }
                                >
                                  {workTypes.map((w) => (
                                    <option key={w.id} value={w.id}>
                                      {w.code.replace(/_/g, " ")}
                                    </option>
                                  ))}
                                </Select>
                                {workType?.requires_quantity && (
                                  <Input
                                    className="h-8 w-16"
                                    type="number"
                                    min={0}
                                    step="0.1"
                                    placeholder="kg"
                                    disabled={readOnly}
                                    defaultValue={jl.quantity_kg ?? ""}
                                    onBlur={(e) =>
                                      updateJobLine(row.id, jl.id, {
                                        quantity_kg: e.target.value ? Number(e.target.value) : null,
                                      })
                                    }
                                  />
                                )}
                                {!readOnly && (
                                  <button
                                    type="button"
                                    className="text-slate-400 hover:text-red-600"
                                    onClick={() => removeJobLine(row.id, jl.id)}
                                    aria-label="Remove job"
                                  >
                                    ✕
                                  </button>
                                )}
                              </div>
                            );
                          })}
                          {!readOnly && (
                            <button
                              type="button"
                              className="text-xs text-emerald-700 underline"
                              onClick={() => addJobLine(row.id)}
                            >
                              + Add job
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          className="h-9 w-24"
                          type="number"
                          min={0}
                          step="1"
                          disabled={readOnly}
                          defaultValue={row.advance_amount}
                          onBlur={(e) =>
                            updateAttendance(row.id, { advance_amount: Number(e.target.value) })
                          }
                        />
                      </td>
                      {!readOnly && (
                        <td className="px-3 py-2">
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => removeEmployee(row.id)}
                          >
                            Remove
                          </Button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardBody>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Transport</CardTitle>
        </CardHeader>
        <CardBody className="grid grid-cols-2 gap-3">
          <div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                disabled={readOnly}
                checked={transport.login_available}
                onChange={(e) => saveTransport({ login_available: e.target.checked })}
              />
              Morning transport
            </label>
            {transport.login_available && (
              <Input
                type="time"
                className="mt-1"
                disabled={readOnly}
                value={transport.login_time ?? ""}
                onChange={(e) => saveTransport({ login_time: e.target.value })}
              />
            )}
          </div>
          <div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                disabled={readOnly}
                checked={transport.logout_available}
                onChange={(e) => saveTransport({ logout_available: e.target.checked })}
              />
              Evening transport
            </label>
            {transport.logout_available && (
              <Input
                type="time"
                className="mt-1"
                disabled={readOnly}
                value={transport.logout_time ?? ""}
                onChange={(e) => saveTransport({ logout_time: e.target.value })}
              />
            )}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Tea Collector</CardTitle>
        </CardHeader>
        <CardBody className="grid grid-cols-2 gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              disabled={readOnly}
              checked={teaCollector.arrived}
              onChange={(e) => saveTeaCollector({ arrived: e.target.checked })}
            />
            Arrived
          </label>
          <div>
            <Label>Amount collected (kg)</Label>
            <Input
              type="number"
              min={0}
              step="0.1"
              disabled={readOnly}
              defaultValue={teaCollector.amount_kg ?? ""}
              onBlur={(e) =>
                saveTeaCollector({
                  amount_kg: e.target.value ? Number(e.target.value) : null,
                })
              }
            />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Cash Summary</CardTitle>
        </CardHeader>
        <CardBody className="space-y-5">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-slate-500">Income</p>
              <p className="text-xs font-medium text-slate-900">
                Total: {formatLKR(cashSummary.receive)}
              </p>
            </div>
            {incomeEntries.map((e) => (
              <div key={e.id} className="flex items-center gap-2">
                <Input
                  className="flex-1"
                  list="income-reason-suggestions"
                  placeholder="Reason (e.g. From bank)"
                  disabled={readOnly}
                  defaultValue={e.reason}
                  onBlur={(ev) => updateCashEntry(e.id, { reason: ev.target.value })}
                />
                <Input
                  type="number"
                  min={0}
                  step="1"
                  className="w-28"
                  disabled={readOnly}
                  defaultValue={e.amount}
                  onBlur={(ev) => updateCashEntry(e.id, { amount: Number(ev.target.value) })}
                />
                {!readOnly && (
                  <button
                    type="button"
                    className="text-slate-400 hover:text-red-600"
                    onClick={() => removeCashEntry(e.id)}
                    aria-label="Remove income entry"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
            {incomeEntries.length === 0 && (
              <p className="text-sm text-slate-400">No income recorded yet.</p>
            )}
            {!readOnly && (
              <button
                type="button"
                className="text-xs text-emerald-700 underline"
                onClick={() => addCashEntry("income")}
              >
                + Add income
              </button>
            )}
          </div>

          <div className="space-y-2 border-t border-slate-100 pt-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-slate-500">Expenses</p>
              <p className="text-xs font-medium text-slate-900">
                Total: {formatLKR(cashSummary.expenses)}
              </p>
            </div>
            {expenseEntries.map((e) => (
              <div key={e.id} className="flex items-center gap-2">
                <Input
                  className="flex-1"
                  list="expense-reason-suggestions"
                  placeholder="Reason (e.g. Loan given)"
                  disabled={readOnly}
                  defaultValue={e.reason}
                  onBlur={(ev) => updateCashEntry(e.id, { reason: ev.target.value })}
                />
                <Input
                  type="number"
                  min={0}
                  step="1"
                  className="w-28"
                  disabled={readOnly}
                  defaultValue={e.amount}
                  onBlur={(ev) => updateCashEntry(e.id, { amount: Number(ev.target.value) })}
                />
                {!readOnly && (
                  <button
                    type="button"
                    className="text-slate-400 hover:text-red-600"
                    onClick={() => removeCashEntry(e.id)}
                    aria-label="Remove expense entry"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
            {expenseEntries.length === 0 && (
              <p className="text-sm text-slate-400">No expenses recorded yet.</p>
            )}
            {!readOnly && (
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  className="text-xs text-emerald-700 underline"
                  onClick={() => addCashEntry("expense")}
                >
                  + Add expense
                </button>
                {totalAdvances > 0 && !hasAdvancePaymentEntry && (
                  <button
                    type="button"
                    className="text-xs text-emerald-700 underline"
                    onClick={() => addCashEntry("expense", "Advance payment", totalAdvances)}
                  >
                    + Advance payment ({formatLKR(totalAdvances)})
                  </button>
                )}
              </div>
            )}
          </div>

          <datalist id="income-reason-suggestions">
            {INCOME_REASON_SUGGESTIONS.map((r) => (
              <option key={r} value={r} />
            ))}
          </datalist>
          <datalist id="expense-reason-suggestions">
            {EXPENSE_REASON_SUGGESTIONS.map((r) => (
              <option key={r} value={r} />
            ))}
          </datalist>

          <div className="space-y-1 border-t border-slate-100 pt-3 text-sm text-slate-600">
            <p>
              Brought forward (previous day):{" "}
              <span className="font-medium">{formatLKR(broughtForward)}</span>
            </p>
            <p>
              Balance: <span className="font-medium">{formatLKR(cashBalance)}</span>
            </p>
          </div>
          <div>
            <Label>Remarks</Label>
            <Input
              disabled={readOnly}
              defaultValue={cashSummary.remarks ?? ""}
              onBlur={(e) => saveCashSummary({ remarks: e.target.value })}
            />
          </div>
        </CardBody>
      </Card>

      {!readOnly && (status === "draft" || isAdmin) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">
              {status === "draft" ? "Step 3 · Review & submit" : "Save corrections"}
            </CardTitle>
          </CardHeader>
          <CardBody className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div>
                <p className="text-xs text-slate-500">Workers</p>
                <p className="font-semibold text-slate-900">{attendance.length}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Total kg</p>
                <p className="font-semibold text-slate-900">{totalKg.toFixed(1)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Advances</p>
                <p className="font-semibold text-slate-900">{formatLKR(totalAdvances)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Cash balance</p>
                <p className="font-semibold text-slate-900">{formatLKR(cashBalance)}</p>
              </div>
            </div>
            {status === "draft" ? (
              <>
                <p className="text-xs text-slate-500">
                  Double-check the entries above, then submit. Submitted reports move to History
                  and are locked from further edits unless an admin unlocks them.
                </p>
                <Button onClick={handleSubmitDay} disabled={submitting} className="w-full sm:w-auto">
                  {submitting ? "Submitting…" : "Submit day"}
                </Button>
              </>
            ) : (
              <>
                <p className="text-xs text-slate-500">
                  This day is already submitted. Field edits above are saved automatically — use
                  this to confirm your corrections went through.
                </p>
                <div className="flex items-center gap-3">
                  <Button
                    onClick={handleSaveChanges}
                    disabled={submitting}
                    className="w-full sm:w-auto"
                  >
                    {submitting ? "Saving…" : "Save changes"}
                  </Button>
                  {savedNotice && (
                    <span className="text-xs font-medium text-emerald-700">Saved ✓</span>
                  )}
                </div>
              </>
            )}
          </CardBody>
        </Card>
      )}
    </div>
  );
}
