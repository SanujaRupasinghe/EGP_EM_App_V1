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
