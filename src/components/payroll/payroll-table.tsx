"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatLKR } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { ExportCsvButton } from "@/components/analysis/export-csv-button";
import { PayrollPdfButton } from "@/components/payroll/payroll-pdf-button";

export type PayrollRow = {
  employeeId: string;
  code: string;
  name: string;
  days: number;
  rate: number;
  gross: number;
  advances: number;
  teaKg: number;
  allowance: number;
  loan: number;
};

export function PayrollTable({
  rows: initialRows,
  periodStart,
  periodEnd,
  monthLabel,
  periodPage,
}: {
  rows: PayrollRow[];
  periodStart: string;
  periodEnd: string;
  monthLabel: string;
  periodPage: number;
}) {
  const [rows, setRows] = useState(initialRows);
  const supabase = createClient();

  async function updateAdjustment(
    employeeId: string,
    field: "allowance" | "loan",
    value: number,
  ) {
    setRows((rs) =>
      rs.map((r) => (r.employeeId === employeeId ? { ...r, [field]: value } : r)),
    );
    await supabase.from("payroll_adjustments").upsert(
      {
        employee_id: employeeId,
        period_start: periodStart,
        period_end: periodEnd,
        [field]: value,
      },
      { onConflict: "employee_id,period_start,period_end" },
    );
  }

  const balances = rows.map((r) => ({
    ...r,
    balance: r.gross + r.allowance - r.advances - r.loan,
  }));

  const totals = balances.reduce(
    (acc, r) => ({
      gross: acc.gross + r.gross,
      advances: acc.advances + r.advances,
      allowance: acc.allowance + r.allowance,
      loan: acc.loan + r.loan,
      balance: acc.balance + r.balance,
    }),
    { gross: 0, advances: 0, allowance: 0, loan: 0, balance: 0 },
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end gap-2">
        <ExportCsvButton
          rows={balances.map((r) => ({
            code: r.code,
            name: r.name,
            days: r.days,
            gross: r.gross,
            advances: r.advances,
            allowance: r.allowance,
            loan: r.loan,
            balance: r.balance,
          }))}
          filename={`payroll_${periodStart}_to_${periodEnd}.csv`}
        />
        <PayrollPdfButton
          rows={balances}
          periodStart={periodStart}
          periodEnd={periodEnd}
          monthLabel={monthLabel}
          periodPage={periodPage}
        />
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500">
              <th className="px-2 py-2">Employee</th>
              <th className="px-2 py-2">Days</th>
              <th className="px-2 py-2">Amount</th>
              <th className="px-2 py-2">Advances</th>
              <th className="px-2 py-2">Allowance</th>
              <th className="px-2 py-2">Loan</th>
              <th className="px-2 py-2">Balance</th>
            </tr>
          </thead>
          <tbody>
            {balances.map((r) => (
              <tr key={r.employeeId} className="border-b border-slate-100">
                <td className="px-2 py-2 whitespace-nowrap">
                  {r.code} — {r.name}
                </td>
                <td className="px-2 py-2">{r.days}</td>
                <td className="px-2 py-2">{formatLKR(r.gross)}</td>
                <td className="px-2 py-2">{formatLKR(r.advances)}</td>
                <td className="px-2 py-2">
                  <Input
                    type="number"
                    className="h-8 w-24"
                    defaultValue={r.allowance}
                    onBlur={(e) =>
                      updateAdjustment(r.employeeId, "allowance", Number(e.target.value))
                    }
                  />
                </td>
                <td className="px-2 py-2">
                  <Input
                    type="number"
                    className="h-8 w-24"
                    defaultValue={r.loan}
                    onBlur={(e) =>
                      updateAdjustment(r.employeeId, "loan", Number(e.target.value))
                    }
                  />
                </td>
                <td className="px-2 py-2 font-medium">{formatLKR(r.balance)}</td>
              </tr>
            ))}
            {balances.length === 0 && (
              <tr>
                <td colSpan={7} className="px-2 py-4 text-center text-slate-400">
                  No one worked in this period yet.
                </td>
              </tr>
            )}
          </tbody>
          {balances.length > 0 && (
            <tfoot>
              <tr className="border-t border-slate-200 bg-slate-50 font-medium">
                <td className="px-2 py-2">Total</td>
                <td className="px-2 py-2"></td>
                <td className="px-2 py-2">{formatLKR(totals.gross)}</td>
                <td className="px-2 py-2">{formatLKR(totals.advances)}</td>
                <td className="px-2 py-2">{formatLKR(totals.allowance)}</td>
                <td className="px-2 py-2">{formatLKR(totals.loan)}</td>
                <td className="px-2 py-2">{formatLKR(totals.balance)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
