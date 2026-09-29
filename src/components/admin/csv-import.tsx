"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { parseCsv, downloadCsv } from "@/lib/csv";
import type { ColumnConfig } from "@/components/admin/crud-table";

function coerce(col: ColumnConfig, raw: string | undefined) {
  const value = (raw ?? "").trim();
  if (col.type === "boolean") {
    if (value === "") return col.key === "active";
    return ["true", "1", "yes", "y"].includes(value.toLowerCase());
  }
  if (col.type === "number") {
    if (value === "") return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return value;
}

export function CsvImport({
  table,
  columns,
  identifierKey,
  onConflict,
  sampleRows,
  templateFilename,
  existing = [],
}: {
  table: string;
  columns: ColumnConfig[];
  /** Column used to identify a row (shown in error messages, and used for
   * client-side de-duplication when the table has no unique constraint to
   * upsert against). */
  identifierKey: string;
  /** DB column with a unique constraint to upsert on. Omit if the table has
   * no such constraint — rows are then de-duplicated against `existing`. */
  onConflict?: string;
  sampleRows: Record<string, string>[];
  templateFilename: string;
  existing?: string[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<Record<string, unknown>[] | null>(null);
  const [rowErrors, setRowErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (inputRef.current) inputRef.current.value = "";
    if (!file) return;
    setError(null);
    setResult(null);
    file.text().then((text) => {
      const { headers, rows } = parseCsv(text);
      const normalizedHeaders = headers.map((h) => h.toLowerCase());
      const get = (cells: string[], key: string) => {
        const idx = normalizedHeaders.indexOf(key.toLowerCase());
        return idx === -1 ? undefined : cells[idx];
      };

      const errs: string[] = [];
      const objects: Record<string, unknown>[] = [];
      rows.forEach((cells, i) => {
        const idValue = get(cells, identifierKey);
        if (!idValue || !idValue.trim()) {
          errs.push(`Row ${i + 2}: missing "${identifierKey}" — skipped.`);
          return;
        }
        const obj: Record<string, unknown> = {};
        for (const col of columns) {
          obj[col.key] = coerce(col, get(cells, col.key));
        }
        objects.push(obj);
      });

      setPreview(objects);
      setRowErrors(errs);
    });
  }

  async function handleSave() {
    if (!preview || preview.length === 0) return;
    setSaving(true);
    setError(null);

    let rowsToSave = preview;
    if (!onConflict) {
      const existingLower = new Set(existing.map((v) => v.toLowerCase()));
      rowsToSave = preview.filter(
        (r) => !existingLower.has(String(r[identifierKey]).toLowerCase()),
      );
    }

    if (rowsToSave.length === 0) {
      setSaving(false);
      setResult("Nothing new to import — all rows already exist.");
      setPreview(null);
      return;
    }

    const { error } = onConflict
      ? await supabase.from(table).upsert(rowsToSave, { onConflict })
      : await supabase.from(table).insert(rowsToSave);

    setSaving(false);
    if (error) {
      setError(
        error.message.includes("duplicate key")
          ? "Some rows already exist and were rejected."
          : error.message,
      );
      return;
    }

    setResult(`Imported ${rowsToSave.length} row${rowsToSave.length === 1 ? "" : "s"}.`);
    setPreview(null);
    setRowErrors([]);
    router.refresh();
  }

  return (
    <Card>
      <CardBody className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-medium text-slate-500">Bulk import from CSV</p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              downloadCsv(columns.map((c) => c.key), sampleRows, templateFilename)
            }
          >
            Download template
          </Button>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          onChange={handleFile}
          className="block w-full text-sm text-slate-600"
        />

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}
        {result && (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {result}
          </p>
        )}
        {rowErrors.length > 0 && (
          <div className="space-y-1 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            {rowErrors.map((e, i) => (
              <p key={i}>{e}</p>
            ))}
          </div>
        )}

        {preview && preview.length > 0 && (
          <div className="space-y-2">
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    {columns.map((c) => (
                      <th key={c.key} className="px-2 py-1 text-left font-medium">
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.slice(0, 8).map((row, i) => (
                    <tr key={i} className="border-b border-slate-100">
                      {columns.map((c) => (
                        <td key={c.key} className="px-2 py-1 whitespace-nowrap">
                          {String(row[c.key] ?? "")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-slate-500">
                {preview.length} row{preview.length === 1 ? "" : "s"} ready to import
                {preview.length > 8 ? " (showing first 8)" : ""}.
              </p>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving
                  ? "Importing…"
                  : `Import ${preview.length} row${preview.length === 1 ? "" : "s"}`}
              </Button>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
