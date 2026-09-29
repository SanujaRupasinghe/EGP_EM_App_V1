export type PayPeriod = { start: string; end: string };

const pad = (n: number) => String(n).padStart(2, "0");

function daysInMonth(year: number, month0: number) {
  return new Date(year, month0 + 1, 0).getDate();
}

/**
 * Estate payroll runs three times a month, in ~10-day periods: 1–10, 11–20,
 * and 21–end-of-month (the third period absorbs the month's extra days, per
 * "1. Meta/Data.txt").
 */
export function periodForDate(dateStr: string): PayPeriod {
  const [y, m, d] = dateStr.split("-").map(Number);
  const month0 = m - 1;
  const idx = d <= 10 ? 0 : d <= 20 ? 1 : 2;
  const startDay = idx * 10 + 1;
  const endDay = idx === 2 ? daysInMonth(y, month0) : startDay + 9;
  return {
    start: `${y}-${pad(m)}-${pad(startDay)}`,
    end: `${y}-${pad(m)}-${pad(endDay)}`,
  };
}

/** Which of the month's 3 periods a date falls in — 1, 2, or 3 — matching the
 * "— 1 / 3" pagination on the paper payroll sheet. */
export function periodPageNumber(dateStr: string): number {
  const d = Number(dateStr.split("-")[2]);
  return (d <= 10 ? 0 : d <= 20 ? 1 : 2) + 1;
}

/** Returns an anchor date inside the period `delta` periods away from `period`
 * (-1 for the previous 10-day period, 1 for the next), correctly rolling over
 * month/year boundaries. */
export function shiftPeriod(period: PayPeriod, delta: number): string {
  const [y, m, d] = period.start.split("-").map(Number);
  const idx = d === 1 ? 0 : d === 11 ? 1 : 2;
  const globalIdx = (y * 12 + (m - 1)) * 3 + idx + delta;
  const monthTotal = Math.floor(globalIdx / 3);
  const newIdx = ((globalIdx % 3) + 3) % 3;
  const newYear = Math.floor(monthTotal / 12);
  const newMonth0 = ((monthTotal % 12) + 12) % 12;
  const startDay = newIdx * 10 + 1;
  return `${newYear}-${pad(newMonth0 + 1)}-${pad(startDay)}`;
}
