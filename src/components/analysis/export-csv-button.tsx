"use client";

import { Button } from "@/components/ui/button";
import { downloadCsv } from "@/lib/csv";

export function ExportCsvButton({
  rows,
  filename,
}: {
  rows: Record<string, string | number | boolean | null | undefined>[];
  filename: string;
}) {
  const headers = rows.length > 0 ? Object.keys(rows[0]) : [];

  return (
    <Button
      variant="secondary"
      size="sm"
      disabled={rows.length === 0}
      onClick={() => downloadCsv(headers, rows, filename)}
    >
      Export CSV
    </Button>
  );
}
