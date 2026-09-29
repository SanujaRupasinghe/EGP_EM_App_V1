"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { markDateAsHoliday } from "@/app/(protected)/history/actions";

export function MarkHolidayButton({
  reportDate,
  hasData = false,
}: {
  reportDate: string;
  /** Whether a report with actual data already exists for this date —
   * marking it a holiday deletes that report and everything under it. */
  hasData?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleMark() {
    if (hasData) {
      const confirmed = window.confirm(
        `${reportDate} already has a saved report. Marking it a holiday permanently deletes ` +
          "that day's attendance, jobs, transport, tea collector, and cash data. This can't be undone. Continue?",
      );
      if (!confirmed) return;
    }

    const reason = window.prompt(`Mark ${reportDate} as a holiday. Reason (optional):`);
    if (reason === null) return;

    setError(null);
    startTransition(async () => {
      const result = await markDateAsHoliday(reportDate, reason);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <Button variant="secondary" size="sm" onClick={handleMark} disabled={pending}>
        {pending ? "Marking…" : "Mark this day as a holiday"}
      </Button>
      {error && <p className="text-xs text-red-700">{error}</p>}
    </div>
  );
}
