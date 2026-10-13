import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatLKR(amount: number) {
  return new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: "LKR",
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(isoDate: string) {
  const [y, m, d] = isoDate.split("-");
  return `${d}/${m}/${y}`;
}

export function todayColombo(): string {
  // en-CA gives YYYY-MM-DD directly, matching Postgres `date` string format.
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Colombo" });
}

const naturalCollator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

/** Natural order for codes: 1A, 1A1, 1A2, 1B1, 2B3, NC-2023, NC-2026-1 … */
export function compareCodes(a: string, b: string): number {
  return naturalCollator.compare(a, b);
}

/** Employee order: m1, m2, … then f1, f2, … (males first, numeric within each). */
export function compareEmployeeCodes(a: string, b: string): number {
  const rank = (c: string) => (/^m/i.test(c) ? 0 : /^f/i.test(c) ? 1 : 2);
  return rank(a) - rank(b) || naturalCollator.compare(a, b);
}

export function sortEmployees<T extends { code: string }>(rows: T[] | null | undefined): T[] {
  return [...(rows ?? [])].sort((x, y) => compareEmployeeCodes(x.code, y.code));
}

export function sortSections<T extends { code: string }>(rows: T[] | null | undefined): T[] {
  return [...(rows ?? [])].sort((x, y) => compareCodes(x.code, y.code));
}
