import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getBroughtForwardBalance, getOrCreateReport } from "@/lib/daily-report";
import { getCurrentProfile } from "@/lib/auth";
import { todayColombo } from "@/lib/utils";
import { EntryForm } from "@/components/entry/entry-form";
import { Card, CardBody } from "@/components/ui/card";
import type { Attendance, JobLine } from "@/lib/supabase/types";

export default async function EntryPage() {
  const session = await getCurrentProfile();
  if (!session) redirect("/login");

  const isAdmin = session.profile?.role === "admin";
  const supabase = await createClient();
  const reportDate = todayColombo();

  const { data: holiday } = await supabase
    .from("holidays")
    .select("*")
    .eq("date", reportDate)
    .maybeSingle();

  if (holiday && !isAdmin) {
    return (
      <Card>
        <CardBody className="space-y-1 py-8 text-center">
          <p className="text-sm font-medium text-slate-900">Today is a holiday</p>
          <p className="text-sm text-slate-500">
            {holiday.reason || "No entry is needed for this day."} Contact an admin if this
            is a mistake.
          </p>
        </CardBody>
      </Card>
    );
  }

  const report = await getOrCreateReport(supabase, reportDate, session.userId);
  const readOnly = report.status === "finalized" && !isAdmin;

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
    supabase.from("employees").select("*").eq("active", true).order("code"),
    supabase.from("sections").select("*").eq("active", true).order("code"),
    supabase.from("work_types").select("*").eq("active", true).order("code"),
    supabase.from("time_presets").select("*").eq("active", true).order("start_time"),
    supabase
      .from("attendance")
      .select("*, job_lines(*)")
      .eq("daily_report_id", report.id),
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

  return (
    <div className="space-y-3">
      {holiday && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Today is marked as a holiday{holiday.reason ? ` (${holiday.reason})` : ""}. Office
          accounts are locked out of this day — you&apos;re editing it as an admin.
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
