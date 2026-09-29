"use server";

import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function createReportForDate(
  reportDate: string,
): Promise<{ error: string | null }> {
  const session = await getCurrentProfile();
  if (!session || session.profile?.role !== "admin") {
    return { error: "Not authorized." };
  }

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
  const session = await getCurrentProfile();
  if (!session || session.profile?.role !== "admin") {
    return { error: "Not authorized." };
  }

  const supabase = await createClient();

  // A holiday and a saved report for the same date don't coexist — marking a
  // day a holiday wipes whatever was recorded for it (attendance, jobs,
  // transport, tea collector, cash — all cascade off daily_reports.id).
  const { error: deleteError } = await supabase
    .from("daily_reports")
    .delete()
    .eq("report_date", reportDate);
  if (deleteError) return { error: deleteError.message };

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
