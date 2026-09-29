"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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
}: {
  table: string;
  columns: ColumnConfig[];
  initialRows: Row[];
  emptyNewRow: Record<string, unknown>;
}) {
  const [rows, setRows] = useState<Row[]>(initialRows);
  const [newRow, setNewRow] = useState<Record<string, unknown>>(emptyNewRow);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const supabase = createClient();

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
    setRows((r) => [...r, data as Row]);
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
        className="h-9"
      />
    );
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <Card>
        <CardBody className="space-y-2">
          <p className="text-xs font-medium text-slate-500">Add new</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {columns
              .filter((c) => c.key !== "active")
              .map((col) => (
                <div key={col.key}>
                  <label className="mb-1 block text-[11px] text-slate-500">{col.label}</label>
                  {renderField(col, newRow[col.key], (v) =>
                    setNewRow((n) => ({ ...n, [col.key]: v })),
                  )}
                </div>
              ))}
          </div>
          <Button size="sm" onClick={handleAdd}>
            Add
          </Button>
        </CardBody>
      </Card>

      <div className="space-y-2">
        {rows.map((row) => (
          <Card key={row.id}>
            <CardBody className="space-y-2">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {columns.map((col) => (
                  <div key={col.key}>
                    <label className="mb-1 block text-[11px] text-slate-500">
                      {col.label}
                    </label>
                    {renderField(col, row[col.key], (v) =>
                      handleUpdate(row.id, { [col.key]: v }),
                    )}
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between">
                {"active" in row ? (
                  <Badge tone={row.active ? "green" : "slate"}>
                    {row.active ? "Active" : "Inactive"}
                  </Badge>
                ) : (
                  <span />
                )}
                <div className="flex items-center gap-2">
                  {savingId === row.id && (
                    <span className="text-xs text-slate-400">Saving…</span>
                  )}
                  <Button variant="danger" size="sm" onClick={() => handleDelete(row.id)}>
                    Delete
                  </Button>
                </div>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}
