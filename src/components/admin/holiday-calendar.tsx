"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type Holiday = { date: string; reason?: string | null };

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const pad = (n: number) => String(n).padStart(2, "0");

function Month({
  year,
  month0,
  holidays,
  today,
}: {
  year: number;
  month0: number;
  holidays: Map<string, string>;
  today: string;
}) {
  const firstDow = new Date(year, month0, 1).getDay();
  const days = new Date(year, month0 + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array<null>(firstDow).fill(null),
    ...Array.from({ length: days }, (_, i) => i + 1),
  ];

  return (
    <div className="rounded-lg border border-slate-200 p-2">
      <p className="mb-1 text-xs font-semibold text-slate-700">{MONTHS[month0]}</p>
      <div className="grid grid-cols-7 gap-0.5 text-center text-[11px]">
        {WEEKDAYS.map((w, i) => (
          <span key={i} className="text-slate-400">
            {w}
          </span>
        ))}
        {cells.map((d, i) => {
          if (d === null) return <span key={i} />;
          const iso = `${year}-${pad(month0 + 1)}-${pad(d)}`;
          const reason = holidays.get(iso);
          const isHoliday = reason !== undefined;
          const isSunday = (firstDow + d - 1) % 7 === 0;
          return (
            <span
              key={i}
              title={isHoliday ? `${iso}: ${reason || "Holiday"}` : undefined}
              className={
                isHoliday
                  ? "cursor-help rounded bg-red-500 font-semibold text-white"
                  : `rounded ${isSunday ? "text-slate-400" : "text-slate-700"} ${
                      iso === today ? "ring-1 ring-emerald-500" : ""
                    }`
              }
            >
              {d}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export function HolidayCalendar({ holidays }: { holidays: Holiday[] }) {
  const todayIso = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Colombo" });
  const [year, setYear] = useState(Number(todayIso.slice(0, 4)));
  const map = new Map(holidays.filter((h) => h.date).map((h) => [h.date, h.reason ?? ""]));
  const count = holidays.filter((h) => h.date.startsWith(`${year}-`)).length;

  return (
    <Card className="space-y-2 p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-800">
          {year} <span className="ml-2 text-xs font-normal text-slate-500">{count} holidays</span>
        </p>
        <div className="flex gap-1">
          <Button variant="secondary" size="sm" onClick={() => setYear((y) => y - 1)}>
            ←
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setYear(Number(todayIso.slice(0, 4)))}>
            Today
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setYear((y) => y + 1)}>
            →
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {MONTHS.map((_, m) => (
          <Month key={m} year={year} month0={m} holidays={map} today={todayIso} />
        ))}
      </div>
      <p className="text-[11px] text-slate-500">
        <span className="mr-1 inline-block h-2 w-2 rounded bg-red-500" />
        Holiday — hover a red date to see the reason.
      </p>
    </Card>
  );
}
