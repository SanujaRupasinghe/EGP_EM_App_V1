import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { todayColombo } from "@/lib/utils";
import { EntryForm } from "@/components/entry/entry-form";
import { DatePickerNav } from "@/components/entry/date-picker-nav";
import { getBroughtForwardBalance } from "@/lib/daily-report";
import type { Attendance, JobLine } from "@/lib/supabase/types";

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const session = await getCurrentProfile();
  if (!session) redirect("/login");

  const today = todayColombo();
  const { date } = await searchParams;
  const reportDate = date && date <= today ? date : today;
  const isAdmin = session.profile?.role === "admin";

  const supabase = await createClient();
  const { data: report } = await supabase
    .from("daily_reports")
    .select("*")
    .eq("report_date", reportDate)
    .maybeSingle();

  if (!report) {
    return (
      <div className="space-y-4">
        <DatePickerNav date={reportDate} max={today} />
        <p className="text-sm text-slate-500">No report was saved for this date.</p>
      </div>
    );
  }

  const [
    { data: employees },
    { data: sections },
    { data: workTypes },
    { data: timePresets },
    { data: attendance },
    { data: transport },
    { data: teaCollector },
    { data: cashSummary },
    { data: cashEntries },
    broughtForward,
  ] = await Promise.all([
    supabase.from("employees").select("*").order("code"),
    supabase.from("sections").select("*").order("code"),
    supabase.from("work_types").select("*").order("code"),
    supabase.from("time_presets").select("*").order("start_time"),
    supabase.from("attendance").select("*, job_lines(*)").eq("daily_report_id", report.id),
    supabase.from("transport_log").select("*").eq("daily_report_id", report.id).maybeSingle(),
    supabase.from("tea_collector").select("*").eq("daily_report_id", report.id).maybeSingle(),
    supabase.from("cash_summary").select("*").eq("daily_report_id", report.id).maybeSingle(),
    supabase
      .from("cash_entries")
      .select("*")
      .eq("daily_report_id", report.id)
      .order("created_at"),
    getBroughtForwardBalance(supabase, reportDate),
  ]);

  // History is a read-only record for office staff — only admins may amend a
  // saved report here. Today's not-yet-submitted report is still edited via
  // the dedicated Entry ("Today") page, not History.
  const readOnly = !isAdmin;

  return (
    <div className="space-y-4">
      <DatePickerNav date={reportDate} max={today} />
      {readOnly && (
        <p className="rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-600">
          History is read-only. Use{" "}
          <Link href="/entry" className="font-medium text-emerald-700 underline">
            Today
          </Link>{" "}
          to edit today&apos;s report before it&apos;s submitted, or ask an admin to make a
          correction here.
        </p>
      )}
      <EntryForm
        reportId={report.id}
        reportDate={report.report_date}
        status={report.status}
        readOnly={readOnly}
        isAdmin={isAdmin}
        alreadyCsvImported={report.csv_imported_at != null}
        employees={employees ?? []}
        sections={sections ?? []}
        workTypes={workTypes ?? []}
        timePresets={timePresets ?? []}
        initialAttendance={(attendance as (Attendance & { job_lines: JobLine[] })[]) ?? []}
        initialTransport={transport}
        initialTeaCollector={teaCollector}
        initialCashSummary={cashSummary}
        initialCashEntries={cashEntries ?? []}
        broughtForward={broughtForward}
        amendmentCount={report.amendment_count}
        lastAmendedAt={report.last_amended_at}
      />
    </div>
  );
}
