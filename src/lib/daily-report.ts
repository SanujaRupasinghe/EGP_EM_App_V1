import type { SupabaseClient } from "@supabase/supabase-js";
import type { DailyReport } from "@/lib/supabase/types";

export async function getOrCreateReport(
  supabase: SupabaseClient,
  reportDate: string,
  userId: string,
): Promise<DailyReport> {
  const { data: existing } = await supabase
    .from("daily_reports")
    .select("*")
    .eq("report_date", reportDate)
    .maybeSingle();

  if (existing) return existing as DailyReport;

  const { data, error } = await supabase
    .from("daily_reports")
    .insert({ report_date: reportDate, created_by: userId })
    .select()
    .single();

  if (error) {
    // Two concurrent requests (e.g. a prefetch racing the real navigation) can both
    // pass the "does it exist" check above and both try to insert. Postgres's unique
    // constraint on report_date lets exactly one succeed; the loser just re-fetches
    // the row the winner created instead of crashing the page.
    if (error.code === "23505") {
      const { data: existingAfterRace } = await supabase
        .from("daily_reports")
        .select("*")
        .eq("report_date", reportDate)
        .single();
      if (existingAfterRace) return existingAfterRace as DailyReport;
    }
    throw error;
  }
  return data as DailyReport;
}

export async function getReport(
  supabase: SupabaseClient,
  reportDate: string,
): Promise<DailyReport | null> {
  const { data } = await supabase
    .from("daily_reports")
    .select("*")
    .eq("report_date", reportDate)
    .maybeSingle();
  return (data as DailyReport | null) ?? null;
}

/** The most recent prior day's closing cash balance — carried forward as the
 * starting point for `reportDate`'s own balance, same as a paper cash book.
 * Skips back past any day that has no cash_summary row at all (a day the
 * office never touched), not just the immediately preceding date. */
export async function getBroughtForwardBalance(
  supabase: SupabaseClient,
  reportDate: string,
): Promise<number> {
  const { data } = await supabase
    .from("cash_summary")
    .select("balance, daily_reports!inner(report_date)")
    .lt("daily_reports.report_date", reportDate)
    .order("report_date", { referencedTable: "daily_reports", ascending: false })
    .limit(1)
    .maybeSingle();
  return Number(data?.balance ?? 0);
}
