import { ImportDailyClient } from "./import-daily-client";

export default function ImportDailyPage() {
  return (
    <div className="space-y-3">
      <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
        Imports run as admin and bypass the &quot;today only&quot; edit lock, so you can
        backfill past dates. Re-importing the same date/employee replaces that
        worker&apos;s job lines for the day.
      </p>
      <ImportDailyClient />
    </div>
  );
}
