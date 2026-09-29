"use client";

import { useMemo, useState } from "react";
import { Select } from "@/components/ui/select";
import { DailyTrendChart } from "@/components/analysis/charts/daily-trend-chart";
import { buildDailyChart } from "@/lib/analytics";
import type { JobLineDetailRow, WorkType } from "@/lib/supabase/types";

type GroupOption = { id: string; label: string };

// Shared by "section daily trend" and "worker daily trend" — both are the
// same shape: pick a work type and (optionally) narrow to one section/worker,
// then plot that combination's day-by-day total across the filtered range.
export function WorkTrendChart({
  detail,
  workTypes,
  groupOptions,
  groupLabel,
  groupKey,
  from,
  to,
}: {
  detail: JobLineDetailRow[];
  workTypes: WorkType[];
  groupOptions: GroupOption[];
  groupLabel: string;
  groupKey: "section_id" | "employee_id";
  from: string;
  to: string;
}) {
  const [workTypeId, setWorkTypeId] = useState(workTypes[0]?.id ?? "");
  const [groupId, setGroupId] = useState("");

  const activeId = workTypes.some((w) => w.id === workTypeId) ? workTypeId : (workTypes[0]?.id ?? "");
  const activeWorkType = workTypes.find((w) => w.id === activeId);
  const byKg = activeWorkType?.requires_quantity ?? true;

  const data = useMemo(() => {
    const filtered = detail.filter(
      (r) => r.work_type_id === activeId && (!groupId || r[groupKey] === groupId),
    );
    return buildDailyChart(filtered, from, to, byKg ? "quantity_kg" : "day_fraction");
  }, [detail, activeId, groupId, groupKey, from, to, byKg]);

  if (workTypes.length === 0) {
    return <p className="py-6 text-center text-sm text-slate-400">No estate work set up yet.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Select
          aria-label="Estate work"
          className="h-8 w-auto text-xs"
          value={activeId}
          onChange={(e) => setWorkTypeId(e.target.value)}
        >
          {workTypes.map((w) => (
            <option key={w.id} value={w.id}>
              {w.code.replace(/_/g, " ")}
            </option>
          ))}
        </Select>
        <Select
          aria-label={groupLabel}
          className="h-8 w-auto text-xs"
          value={groupId}
          onChange={(e) => setGroupId(e.target.value)}
        >
          <option value="">All {groupLabel.toLowerCase()}s</option>
          {groupOptions.map((g) => (
            <option key={g.id} value={g.id}>
              {g.label}
            </option>
          ))}
        </Select>
      </div>
      <DailyTrendChart data={data} valueSuffix={byKg ? " kg" : " worker-days"} />
    </div>
  );
}
