"use client";

import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function addDays(dateStr: string, delta: number) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + delta);
  return d.toLocaleDateString("en-CA");
}

export function DatePickerNav({ date, max }: { date: string; max: string }) {
  const router = useRouter();
  const pathname = usePathname();

  function goTo(next: string) {
    if (next > max) return;
    // router.push alone can serve a stale client-cached snapshot of the
    // target date (e.g. if you visited it earlier in the session before
    // more data was entered) — refresh forces a fresh server fetch.
    router.push(`${pathname}?date=${next}`);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="secondary"
        size="sm"
        aria-label="Previous day"
        onClick={() => goTo(addDays(date, -1))}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <Input
        type="date"
        value={date}
        max={max}
        onChange={(e) => e.target.value && goTo(e.target.value)}
        className="h-9 w-auto"
      />
      <Button
        variant="secondary"
        size="sm"
        aria-label="Next day"
        disabled={date >= max}
        onClick={() => goTo(addDays(date, 1))}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
