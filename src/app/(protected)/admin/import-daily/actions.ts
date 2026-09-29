"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

async function assertAdmin() {
  const session = await getCurrentProfile();
  if (!session || session.profile?.role !== "admin") {
    throw new Error("Not authorized");
  }
  return session;
}

export type AttendanceCsvRow = {
  report_date: string;
  employee_code: string;
  time_preset_label: string;
  advance_amount: number;
  section_code: string;
  work_type_code: string;
  quantity_kg: number | null;
};

export async function importAttendanceRows(rows: AttendanceCsvRow[]) {
  const session = await assertAdmin();
  const admin = createAdminClient();

  const [employeesRes, sectionsRes, workTypesRes, presetsRes] = await Promise.all([
    admin.from("employees").select("id, code"),
    admin.from("sections").select("id, code"),
    admin.from("work_types").select("id, code"),
    admin.from("time_presets").select("id, label"),
  ]);

  const employeeMap = new Map(
    (employeesRes.data ?? []).map((e) => [e.code.toLowerCase(), e.id as string]),
  );
  const sectionMap = new Map(
    (sectionsRes.data ?? []).map((s) => [s.code.toLowerCase(), s.id as string]),
  );
  const workTypeMap = new Map(
    (workTypesRes.data ?? []).map((w) => [w.code.toLowerCase(), w.id as string]),
  );
  const presetMap = new Map(
    (presetsRes.data ?? []).map((p) => [p.label.toLowerCase(), p.id as string]),
  );

  const errors: string[] = [];
  const byReportDate = new Map<string, AttendanceCsvRow[]>();

  rows.forEach((row, i) => {
    const rowNum = i + 2;
    if (!employeeMap.has(row.employee_code.toLowerCase())) {
      errors.push(`Row ${rowNum}: unknown employee code "${row.employee_code}".`);
      return;
    }
    if (!presetMap.has(row.time_preset_label.toLowerCase())) {
      errors.push(`Row ${rowNum}: unknown time preset "${row.time_preset_label}".`);
      return;
    }
    if (!sectionMap.has(row.section_code.toLowerCase())) {
      errors.push(`Row ${rowNum}: unknown section code "${row.section_code}".`);
      return;
    }
    if (!workTypeMap.has(row.work_type_code.toLowerCase())) {
      errors.push(`Row ${rowNum}: unknown work type code "${row.work_type_code}".`);
      return;
    }
    const list = byReportDate.get(row.report_date) ?? [];
    list.push(row);
    byReportDate.set(row.report_date, list);
  });

  let importedReports = 0;
  let importedJobLines = 0;

  for (const [reportDate, dayRows] of byReportDate) {
    const { data: existingReport } = await admin
      .from("daily_reports")
      .select("id")
      .eq("report_date", reportDate)
      .maybeSingle();

    let reportId: string;
    if (existingReport) {
      reportId = existingReport.id;
    } else {
      const { data: newReport, error } = await admin
        .from("daily_reports")
        .insert({ report_date: reportDate, created_by: session.userId })
        .select("id")
        .single();
      if (error || !newReport) {
        errors.push(`${reportDate}: ${error?.message ?? "could not create report"}`);
        continue;
      }
      reportId = newReport.id;
      importedReports++;
    }

    const byEmployee = new Map<string, AttendanceCsvRow[]>();
    for (const row of dayRows) {
      const list = byEmployee.get(row.employee_code) ?? [];
      list.push(row);
      byEmployee.set(row.employee_code, list);
    }

    for (const [employeeCode, empRows] of byEmployee) {
      const employeeId = employeeMap.get(employeeCode.toLowerCase())!;
      const first = empRows[0];
      const presetId = presetMap.get(first.time_preset_label.toLowerCase())!;

      const { data: attendance, error: attError } = await admin
        .from("attendance")
        .upsert(
          {
            daily_report_id: reportId,
            employee_id: employeeId,
            time_preset_id: presetId,
            advance_amount: first.advance_amount ?? 0,
          },
          { onConflict: "daily_report_id,employee_id" },
        )
        .select("id")
        .single();

      if (attError || !attendance) {
        errors.push(`${reportDate} / ${employeeCode}: ${attError?.message}`);
        continue;
      }

      await admin.from("job_lines").delete().eq("attendance_id", attendance.id);

      const jobLines = empRows.map((r) => ({
        attendance_id: attendance.id,
        section_id: sectionMap.get(r.section_code.toLowerCase())!,
        work_type_id: workTypeMap.get(r.work_type_code.toLowerCase())!,
        quantity_kg: r.quantity_kg,
      }));

      const { error: jlError } = await admin.from("job_lines").insert(jobLines);
      if (jlError) {
        errors.push(`${reportDate} / ${employeeCode}: ${jlError.message}`);
        continue;
      }
      importedJobLines += jobLines.length;
    }
  }

  revalidatePath("/history");
  revalidatePath("/analysis");
  revalidatePath("/payroll");

  return { importedReports, importedJobLines, errors };
}

export type DailySummaryCsvRow = {
  report_date: string;
  login_available: boolean;
  login_time: string | null;
  logout_available: boolean;
  logout_time: string | null;
  collector_arrived: boolean;
  collector_amount_kg: number | null;
  cash_receive: number;
  cash_expenses: number;
  cash_description: string | null;
  cash_remarks: string | null;
};

export async function importDailySummaryRows(rows: DailySummaryCsvRow[]) {
  const session = await assertAdmin();
  const admin = createAdminClient();
  const errors: string[] = [];
  let count = 0;

  for (const row of rows) {
    const { data: existingReport } = await admin
      .from("daily_reports")
      .select("id")
      .eq("report_date", row.report_date)
      .maybeSingle();

    let reportId: string;
    if (existingReport) {
      reportId = existingReport.id;
    } else {
      const { data: newReport, error } = await admin
        .from("daily_reports")
        .insert({ report_date: row.report_date, created_by: session.userId })
        .select("id")
        .single();
      if (error || !newReport) {
        errors.push(`${row.report_date}: ${error?.message ?? "could not create report"}`);
        continue;
      }
      reportId = newReport.id;
    }

    const balance = row.cash_receive - row.cash_expenses;

    const [transportRes, collectorRes, cashRes] = await Promise.all([
      admin.from("transport_log").upsert(
        {
          daily_report_id: reportId,
          login_available: row.login_available,
          login_time: row.login_time,
          logout_available: row.logout_available,
          logout_time: row.logout_time,
        },
        { onConflict: "daily_report_id" },
      ),
      admin.from("tea_collector").upsert(
        {
          daily_report_id: reportId,
          arrived: row.collector_arrived,
          amount_kg: row.collector_amount_kg,
        },
        { onConflict: "daily_report_id" },
      ),
      admin.from("cash_summary").upsert(
        {
          daily_report_id: reportId,
          receive: row.cash_receive,
          expenses: row.cash_expenses,
          balance,
          description: row.cash_description,
          remarks: row.cash_remarks,
        },
        { onConflict: "daily_report_id" },
      ),
    ]);

    const rowError = transportRes.error ?? collectorRes.error ?? cashRes.error;
    if (rowError) {
      errors.push(`${row.report_date}: ${rowError.message}`);
      continue;
    }
    count++;
  }

  revalidatePath("/history");
  revalidatePath("/analysis");

  return { count, errors };
}
