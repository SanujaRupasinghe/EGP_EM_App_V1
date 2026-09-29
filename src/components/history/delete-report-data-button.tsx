"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { deleteReportForHolidayDate } from "@/app/(protected)/history/actions";

// Shown when a date is already marked a holiday but still has a leftover
// report (e.g. the holiday was added via Admin -> Holidays directly, before
// that flow deleted matching reports too).
export function DeleteReportDataButton({ reportDate }: { reportDate: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDelete() {
    const confirmed = window.confirm(
      `${reportDate} is marked as a holiday but still has saved report data. Delete that ` +
        "day's attendance, jobs, transport, tea collector, and cash data now? This can't be undone.",
    );
    if (!confirmed) return;

    setError(null);
    startTransition(async () => {
      const result = await deleteReportForHolidayDate(reportDate);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <Button variant="danger" size="sm" onClick={handleDelete} disabled={pending}>
        {pending ? "Deleting…" : "Delete leftover data for this holiday"}
      </Button>
      {error && <p className="text-xs text-red-700">{error}</p>}
    </div>
  );
}
