"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { compareCodes, compareEmployeeCodes } from "@/lib/utils";

type FieldType = "text" | "number" | "time" | "date" | "boolean";

export type ColumnConfig = {
  key: string;
  label: string;
  type: FieldType;
  step?: string;
};

type Row = Record<string, unknown> & { id: string };

export function CrudTable({
  table,
  columns,
  initialRows,
  emptyNewRow,
  order,
  onRowsChange,
}: {
  table: string;
  columns: ColumnConfig[];
  initialRows: Row[];
  emptyNewRow: Record<string, unknown>;
  order?: "employee" | "natural";
  onRowsChange?: (rows: Row[]) => void;
}) {
  const [rows, setRows] = useState<Row[]>(initialRows);
  const [newRow, setNewRow] = useState<Record<string, unknown>>(emptyNewRow);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    onRowsChange?.(rows);
  }, [rows, onRowsChange]);

  function friendlyError(message: string) {
    if (message.includes("foreign key") || message.includes("violates")) {
      return "Can't delete — it's already used in a saved report. Deactivate it instead.";
    }
    if (message.includes("duplicate key")) {
      return "That code already exists.";
    }
    return message;
  }

  async function handleAdd() {
    setError(null);
    const { data, error } = await supabase.from(table).insert(newRow).select().single();
    if (error) {
      setError(friendlyError(error.message));
      return;
    }
    setRows((r) => {
      const next = [...r, data as Row];
      if (!order) return next;
      const cmp = order === "employee" ? compareEmployeeCodes : compareCodes;
      return next.sort((a, b) => cmp(String(a.code), String(b.code)));
    });
    setNewRow(emptyNewRow);
  }

  async function handleUpdate(id: string, patch: Record<string, unknown>) {
    setSavingId(id);
    setError(null);
    const { error } = await supabase.from(table).update(patch).eq("id", id);
    setSavingId(null);
    if (error) {
      setError(friendlyError(error.message));
      return;
    }
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  async function handleDelete(id: string) {
    setError(null);
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) {
      setError(friendlyError(error.message));
      return;
    }
    setRows((rs) => rs.filter((r) => r.id !== id));
  }

  function renderField(
    col: ColumnConfig,
    value: unknown,
    onChange: (v: unknown) => void,
  ) {
    if (col.type === "boolean") {
      return (
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
          className="h-4 w-4"
        />
      );
    }
    return (
      <Input
        type={
          col.type === "number"
            ? "number"
            : col.type === "time"
              ? "time"
              : col.type === "date"
                ? "date"
                : "text"
        }
        step={col.step}
        value={(value as string | number) ?? ""}
        onChange={(e) =>
          onChange(col.type === "number" ? Number(e.target.value) : e.target.value)
        }
        className="h-8 px-2 py-0 text-sm"
      />
    );
  }

  const gridCols = {
    gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr)) auto`,
  };

  return (
    <div className="space-y-2">
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <Card className="p-2">
        <div className="grid items-end gap-2" style={gridCols}>
          {columns.map((col) => (
            <div key={col.key}>
              <label className="mb-0.5 block text-[11px] text-slate-500">
                {col.key === "active" ? "Active" : `New ${col.label.toLowerCase()}`}
              </label>
              {renderField(col, newRow[col.key], (v) =>
                setNewRow((n) => ({ ...n, [col.key]: v })),
              )}
            </div>
          ))}
          <Button size="sm" onClick={handleAdd}>
            Add
          </Button>
        </div>
      </Card>

      <Card className="divide-y divide-slate-100">
        <div
          className="grid gap-2 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-500"
          style={gridCols}
        >
          {columns.map((col) => (
            <span key={col.key}>{col.label}</span>
          ))}
          <span className="w-16" />
        </div>
        {rows.map((row) => (
          <div
            key={row.id}
            className="grid items-center gap-2 px-2 py-1"
            style={gridCols}
          >
            {columns.map((col) => (
              <div key={col.key}>
                {renderField(col, row[col.key], (v) => handleUpdate(row.id, { [col.key]: v }))}
              </div>
            ))}
            <div className="flex w-16 items-center justify-end gap-1">
              {savingId === row.id && <span className="text-[10px] text-slate-400">…</span>}
              <Button variant="danger" size="sm" onClick={() => handleDelete(row.id)}>
                Del
              </Button>
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}
