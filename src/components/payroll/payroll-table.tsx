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
  /** Amount = rate × days worked. */
  gross: number;
  advances: number;
  allowance: number;
  loan: number;
  /** Day-of-month numbers worked in the range, e.g. "1, 2, 3, 5½". */
  workedOn: string;
};

export function PayrollTable({
  rows: initialRows,
  rangeLabel,
  periodStart,
  periodEnd,
  monthLabel,
  periodPage,
}: {
  rows: PayrollRow[];
  rangeLabel: string;
  periodStart: string;
  periodEnd: string;
  monthLabel: string;
  periodPage: number;
}) {
  const [rows, setRows] = useState(initialRows);
  const supabase = createClient();

  async function updateLoan(employeeId: string, value: number) {
    setRows((rs) => rs.map((r) => (r.employeeId === employeeId ? { ...r, loan: value } : r)));
    await supabase.from("payroll_adjustments").upsert(
      {
        employee_id: employeeId,
        period_start: periodStart,
        period_end: periodEnd,
        loan: value,
      },
      { onConflict: "employee_id,period_start,period_end" },
    );
  }

  // Total = amount + allowance (tea target is blank for now);
  // Balance = total − loan − deducted advance.
  const balances = rows.map((r) => {
    const total = r.gross + r.allowance;
    return { ...r, total, balance: total - r.loan - r.advances };
  });

  const totals = balances.reduce(
    (acc, r) => ({
      days: acc.days + r.days,
      gross: acc.gross + r.gross,
      allowance: acc.allowance + r.allowance,
      total: acc.total + r.total,
      loan: acc.loan + r.loan,
      advances: acc.advances + r.advances,
      balance: acc.balance + r.balance,
    }),
    { days: 0, gross: 0, allowance: 0, total: 0, loan: 0, advances: 0, balance: 0 },
  );

  const th = "px-2 py-2";
  const thNum = "px-2 py-2 text-right";
  const tdNum = "px-2 py-2 text-right whitespace-nowrap";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end gap-2">
        <ExportCsvButton
          rows={balances.map((r) => ({
            code: r.code,
            name: r.name,
            days: r.days,
            worked_on: r.workedOn,
            rate: r.rate,
            amount: r.gross,
            allowance: r.allowance,
            tea_target: "",
            total: r.total,
            loan: r.loan,
            advance_deducted: r.advances,
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
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500">
              <th className={`${th} sticky left-0 z-10 bg-slate-50`}>Employee</th>
              <th className={thNum}># days</th>
              <th className={th}>Days worked ({rangeLabel})</th>
              <th className={thNum}>Rate</th>
              <th className={thNum}>Amount</th>
              <th className={thNum}>Allowance</th>
              <th className={thNum}>Tea target</th>
              <th className={thNum}>Total</th>
              <th className={th}>Loan</th>
              <th className={thNum}>Advance</th>
              <th className={thNum}>Balance</th>
            </tr>
          </thead>
          <tbody>
            {balances.map((r) => (
              <tr key={r.employeeId} className="border-b border-slate-100">
                <td className="sticky left-0 z-10 whitespace-nowrap bg-white px-2 py-2">
                  {r.code} — {r.name}
                </td>
                <td className={tdNum}>{r.days}</td>
                <td className="max-w-48 px-2 py-2 text-xs text-slate-600">{r.workedOn}</td>
                <td className={tdNum}>{formatLKR(r.rate)}</td>
                <td className={tdNum}>{formatLKR(r.gross)}</td>
                <td className={tdNum}>{r.allowance ? formatLKR(r.allowance) : "—"}</td>
                <td className={`${tdNum} text-slate-300`}></td>
                <td className={tdNum}>{formatLKR(r.total)}</td>
                <td className="px-2 py-2">
                  <Input
                    type="number"
                    className="h-8 w-24"
                    defaultValue={r.loan}
                    onBlur={(e) => updateLoan(r.employeeId, Number(e.target.value))}
                  />
                </td>
                <td className={tdNum}>{r.advances ? formatLKR(r.advances) : "—"}</td>
                <td className={`${tdNum} font-medium`}>{formatLKR(r.balance)}</td>
              </tr>
            ))}
            {balances.length === 0 && (
              <tr>
                <td colSpan={11} className="px-2 py-4 text-center text-slate-400">
                  No one worked in this period yet.
                </td>
              </tr>
            )}
          </tbody>
          {balances.length > 0 && (
            <tfoot>
              <tr className="border-t border-slate-200 bg-slate-50 font-medium">
                <td className="sticky left-0 z-10 bg-slate-50 px-2 py-2">Total</td>
                <td className={tdNum}>{totals.days}</td>
                <td></td>
                <td></td>
                <td className={tdNum}>{formatLKR(totals.gross)}</td>
                <td className={tdNum}>{formatLKR(totals.allowance)}</td>
                <td></td>
                <td className={tdNum}>{formatLKR(totals.total)}</td>
                <td className="px-2 py-2">{formatLKR(totals.loan)}</td>
                <td className={tdNum}>{formatLKR(totals.advances)}</td>
                <td className={tdNum}>{formatLKR(totals.balance)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
