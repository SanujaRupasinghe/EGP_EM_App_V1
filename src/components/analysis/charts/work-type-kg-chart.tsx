"use client";

import { useMemo, useState } from "react";
import { BarChart } from "@/components/analysis/charts/bar-chart";
import { Select } from "@/components/ui/select";
import type { JobLineDetailRow, WorkType } from "@/lib/supabase/types";

// Different estate works are measured in different units — tea plucking and
// fertilizing in kg, weeding in worker-days (the day_fraction of whoever did
// it, since weeding has no kg quantity at all) — so this chart always shows
// exactly one work type at a time, in its own unit, instead of blending
// incompatible totals together.
export function WorkTypeKgChart({
  detail,
  workTypes,
  groupBy,
  limit = 15,
  showTable = true,
}: {
  detail: JobLineDetailRow[];
  workTypes: WorkType[];
  groupBy: "employee" | "section";
  limit?: number;
  showTable?: boolean;
}) {
  const [workTypeId, setWorkTypeId] = useState(workTypes[0]?.id ?? "");
  const activeId = workTypes.some((w) => w.id === workTypeId) ? workTypeId : (workTypes[0]?.id ?? "");
  const activeWorkType = workTypes.find((w) => w.id === activeId);
  const byKg = activeWorkType?.requires_quantity ?? true;

  const data = useMemo(() => {
    const agg = new Map<string, number>();
    for (const r of detail) {
      if (r.work_type_id !== activeId) continue;
      const key = groupBy === "employee" ? `${r.employee_code} — ${r.employee_name}` : r.section_code;
      const amount = byKg ? Number(r.quantity_kg ?? 0) : Number(r.day_fraction ?? 0);
      agg.set(key, (agg.get(key) ?? 0) + amount);
    }
    return Array.from(agg.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, limit);
  }, [detail, activeId, byKg, groupBy, limit]);

  if (workTypes.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-slate-400">No estate work set up yet.</p>
    );
  }

  return (
    <div className="space-y-3">
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
      <BarChart data={data} valueSuffix={byKg ? " kg" : " worker-days"} showTable={showTable} />
    </div>
  );
}
