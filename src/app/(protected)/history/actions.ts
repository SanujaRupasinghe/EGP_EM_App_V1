"use server";

import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { todayColombo } from "@/lib/utils";

// Admins can act on any date. office_v2 users may only back-fill a past date
// that has no report yet (the database policies enforce the same rule).
async function authorize(reportDate: string) {
  const session = await getCurrentProfile();
  const role = session?.profile?.role;
  if (!session || (role !== "admin" && role !== "office_v2")) {
    return { session: null, error: "Not authorized." };
  }
  if (role === "office_v2" && reportDate >= todayColombo()) {
    return { session: null, error: "You can only change past days." };
  }
  return { session, error: null };
}

export async function createReportForDate(
  reportDate: string,
): Promise<{ error: string | null }> {
  const { session, error: authError } = await authorize(reportDate);
  if (!session) return { error: authError };

  const supabase = await createClient();

  const { data: holiday } = await supabase
    .from("holidays")
    .select("id")
    .eq("date", reportDate)
    .maybeSingle();
  if (holiday) {
    return {
      error: "This date is marked as a holiday. Remove the holiday in Admin → Holidays first.",
    };
  }

  const { error } = await supabase
    .from("daily_reports")
    .insert({ report_date: reportDate, created_by: session.userId });
  if (error) return { error: error.message };

  return { error: null };
}

export async function markDateAsHoliday(
  reportDate: string,
  reason: string,
): Promise<{ error: string | null }> {
  const { session, error: authError } = await authorize(reportDate);
  if (!session) return { error: authError };

  const supabase = await createClient();

  // A holiday and a saved report for the same date don't coexist — marking a
  // day a holiday wipes whatever was recorded for it (attendance, jobs,
  // transport, tea collector, cash — all cascade off daily_reports.id).
  // office_v2 can never delete data, so for them an existing report blocks it.
  if (session.profile?.role === "office_v2") {
    const { data: existing } = await supabase
      .from("daily_reports")
      .select("id")
      .eq("report_date", reportDate)
      .maybeSingle();
    if (existing) return { error: "This date already has a report. Ask an admin to change it." };
  } else {
    const { error: deleteError } = await supabase
      .from("daily_reports")
      .delete()
      .eq("report_date", reportDate);
    if (deleteError) return { error: deleteError.message };
  }

  const { error } = await supabase
    .from("holidays")
    .insert({ date: reportDate, reason: reason.trim() || null, created_by: session.userId });
  if (error) return { error: error.message };

  return { error: null };
}

// Cleans up a date that's already marked a holiday (added via Admin →
// Holidays directly, not this page's own action above) but still has a
// leftover report from before the holiday was set.
export async function deleteReportForHolidayDate(
  reportDate: string,
): Promise<{ error: string | null }> {
  const session = await getCurrentProfile();
  if (!session || session.profile?.role !== "admin") {
    return { error: "Not authorized." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("daily_reports").delete().eq("report_date", reportDate);
  if (error) return { error: error.message };

  return { error: null };
}
