"use client";

import { useState } from "react";
import { CrudTable, type ColumnConfig } from "@/components/admin/crud-table";
import { HolidayCalendar } from "@/components/admin/holiday-calendar";

type Row = Record<string, unknown> & { id: string };

export function HolidaysManager({
  columns,
  initialRows,
}: {
  columns: ColumnConfig[];
  initialRows: Row[];
}) {
  const [rows, setRows] = useState<Row[]>(initialRows);

  return (
    <div className="space-y-3">
      <HolidayCalendar
        holidays={rows.map((r) => ({ date: String(r.date ?? ""), reason: r.reason as string }))}
      />
      <CrudTable
        table="holidays"
        columns={columns}
        initialRows={initialRows}
        emptyNewRow={{ date: "", reason: "" }}
        onRowsChange={setRows}
      />
    </div>
  );
}
