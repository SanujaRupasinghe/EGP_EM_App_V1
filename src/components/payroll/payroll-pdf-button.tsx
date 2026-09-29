"use client";

import { Button } from "@/components/ui/button";
import { formatDate, formatLKR } from "@/lib/utils";

type Row = {
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
  balance: number;
};

function esc(v: unknown): string {
  return String(v ?? "").replace(/[&<>"]/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&quot;",
  );
}

// No PDF library in this project — the browser's own "Print to PDF" (via
// window.print() on a purpose-built print window) reproduces page 3 of
// "1. Meta/Tea Estate Daily Report Template.pdf" without adding a dependency.
export function PayrollPdfButton({
  rows,
  periodStart,
  periodEnd,
  monthLabel,
  periodPage,
}: {
  rows: Row[];
  periodStart: string;
  periodEnd: string;
  monthLabel: string;
  periodPage: number;
}) {
  function handlePrint() {
    const win = window.open("", "_blank", "width=900,height=1100");
    if (!win) return;

    const totals = rows.reduce(
      (acc, r) => ({
        gross: acc.gross + r.gross,
        advances: acc.advances + r.advances,
        allowance: acc.allowance + r.allowance,
        teaKg: acc.teaKg + r.teaKg,
        loan: acc.loan + r.loan,
        balance: acc.balance + r.balance,
      }),
      { gross: 0, advances: 0, allowance: 0, teaKg: 0, loan: 0, balance: 0 },
    );

    const rowsHtml = rows
      .map(
        (r) => `<tr>
          <td>${esc(r.code)}</td>
          <td>${esc(r.name)}</td>
          <td class="num">${r.days}</td>
          <td class="num">${formatLKR(r.rate)}</td>
          <td class="num">${formatLKR(r.gross)}</td>
          <td class="num">${formatLKR(r.allowance)}</td>
          <td class="num">${r.teaKg > 0 ? r.teaKg.toFixed(1) : ""}</td>
          <td class="num">${formatLKR(r.gross + r.allowance)}</td>
          <td class="num">${formatLKR(r.loan)}</td>
          <td class="num">${formatLKR(r.advances)}</td>
          <td class="num">${formatLKR(r.balance)}</td>
        </tr>`,
      )
      .join("");

    win.document.write(`<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Payroll — ${esc(monthLabel)} (${periodPage}/3)</title>
<style>
  @page { size: A4 landscape; margin: 12mm; }
  body { font-family: system-ui, sans-serif; color: #0f172a; margin: 0; }
  .header { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 4px; }
  h1 { font-size: 16px; margin: 0; }
  .range { font-size: 12px; margin: 0 0 12px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th, td { border: 1px solid #000; padding: 4px 6px; text-align: left; }
  th { background: #f1f5f9; font-weight: 700; }
  td.num, th.num { text-align: right; }
  tfoot td { font-weight: 700; background: #f8fafc; }
</style>
</head>
<body>
  <div class="header">
    <h1>For the month of ${esc(monthLabel)} — ${periodPage} / 3</h1>
  </div>
  <p class="range">From ${esc(formatDate(periodStart))} &nbsp; To ${esc(formatDate(periodEnd))}</p>
  <table>
    <thead>
      <tr>
        <th>ID</th>
        <th>Name</th>
        <th class="num">No of Days</th>
        <th class="num">Rate</th>
        <th class="num">Amount</th>
        <th class="num">Allowance</th>
        <th class="num">Tea target</th>
        <th class="num">Total</th>
        <th class="num">Loan</th>
        <th class="num">Deduct Advance</th>
        <th class="num">Balance</th>
      </tr>
    </thead>
    <tbody>${rowsHtml || `<tr><td colspan="11" style="text-align:center;color:#64748b">No one worked in this period</td></tr>`}</tbody>
    <tfoot>
      <tr>
        <td colspan="4">Total</td>
        <td class="num">${formatLKR(totals.gross)}</td>
        <td class="num">${formatLKR(totals.allowance)}</td>
        <td class="num">${totals.teaKg > 0 ? totals.teaKg.toFixed(1) : ""}</td>
        <td class="num">${formatLKR(totals.gross + totals.allowance)}</td>
        <td class="num">${formatLKR(totals.loan)}</td>
        <td class="num">${formatLKR(totals.advances)}</td>
        <td class="num">${formatLKR(totals.balance)}</td>
      </tr>
    </tfoot>
  </table>
</body>
</html>`);
    win.document.close();
    win.focus();
    win.onload = () => win.print();
  }

  return (
    <Button variant="secondary" size="sm" disabled={rows.length === 0} onClick={handlePrint}>
      Print / PDF
    </Button>
  );
}
