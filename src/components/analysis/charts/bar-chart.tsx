"use client";

import { useId, useState } from "react";

export type BarDatum = { label: string; value: number };

function formatAxisValue(v: number): string {
  if (v >= 1000) return `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k`;
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

export function BarChart({
  data,
  valueSuffix = "",
  decimals = 1,
  emptyLabel = "No data for this range.",
  showTable = true,
}: {
  data: BarDatum[];
  valueSuffix?: string;
  /** Decimal places for displayed values — a plain number, not a formatter
   * function, since this component is rendered from a Server Component and
   * functions can't cross that boundary as props. */
  decimals?: number;
  emptyLabel?: string;
  showTable?: boolean;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const gradientId = useId();

  if (data.length === 0) {
    return <p className="py-6 text-center text-sm text-slate-400">{emptyLabel}</p>;
  }

  const formatValue = (v: number) =>
    v.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

  const max = Math.max(1, ...data.map((d) => d.value));
  const barWidth = 28;
  const gap = 20;
  const plotHeight = 160;
  const topGutter = 24;
  const labelGutter = 52;
  const leftGutter = 34;
  const chartWidth = leftGutter + Math.max(data.length * (barWidth + gap), 300);
  const chartHeight = topGutter + plotHeight + labelGutter;
  const gridSteps = 4;

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-lg bg-slate-50/60 px-1 py-2">
        <svg
          role="img"
          aria-label="Bar chart"
          width={chartWidth}
          height={chartHeight}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" />
              <stop offset="100%" stopColor="#047857" />
            </linearGradient>
          </defs>

          {Array.from({ length: gridSteps + 1 }).map((_, i) => {
            const frac = i / gridSteps;
            const y = topGutter + plotHeight * (1 - frac);
            const value = max * frac;
            return (
              <g key={i}>
                <line
                  x1={leftGutter}
                  y1={y}
                  x2={chartWidth}
                  y2={y}
                  stroke={i === 0 ? "#cbd5e1" : "#e2e8f0"}
                  strokeWidth={1}
                  strokeDasharray={i === 0 ? undefined : "3 3"}
                />
                <text
                  x={leftGutter - 8}
                  y={y + 3}
                  textAnchor="end"
                  className="fill-slate-400"
                  style={{ fontSize: 9 }}
                >
                  {formatAxisValue(value)}
                </text>
              </g>
            );
          })}

          {data.map((d, i) => {
            const h = Math.max(2, (d.value / max) * plotHeight);
            const x = leftGutter + i * (barWidth + gap) + gap / 2;
            const y = topGutter + plotHeight - h;
            const isHovered = hovered === i;
            const labelX = x + barWidth / 2;
            const labelY = topGutter + plotHeight + 14;
            return (
              <g
                key={d.label}
                tabIndex={0}
                onPointerEnter={() => setHovered(i)}
                onPointerLeave={() => setHovered(null)}
                onFocus={() => setHovered(i)}
                onBlur={() => setHovered(null)}
                style={{ cursor: "pointer", outline: "none" }}
              >
                <title>{`${d.label}: ${formatValue(d.value)}${valueSuffix}`}</title>
                <rect
                  x={x - gap / 2}
                  y={topGutter}
                  width={barWidth + gap}
                  height={plotHeight}
                  rx={4}
                  fill={isHovered ? "#0f766e0d" : "transparent"}
                />
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={h}
                  rx={5}
                  fill={isHovered ? "#065f46" : `url(#${gradientId})`}
                />
                <text
                  x={labelX}
                  y={Math.max(14, y - 6)}
                  textAnchor="middle"
                  className="fill-slate-900"
                  style={{ fontSize: 10, fontWeight: 700 }}
                >
                  {formatValue(d.value)}
                  {valueSuffix}
                </text>
                <text
                  x={labelX}
                  y={labelY}
                  textAnchor="end"
                  className={isHovered ? "fill-slate-800" : "fill-slate-600"}
                  style={{ fontSize: 10, fontWeight: isHovered ? 700 : 400 }}
                  transform={`rotate(-40 ${labelX} ${labelY})`}
                >
                  {d.label.length > 20 ? `${d.label.slice(0, 19)}…` : d.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      {showTable && (
        <details className="text-xs text-slate-500">
          <summary className="cursor-pointer select-none">Show as table</summary>
          <table className="mt-2 w-full text-left">
            <tbody>
              {data.map((d) => (
                <tr key={d.label} className="border-b border-slate-100">
                  <td className="py-1 pr-2">{d.label}</td>
                  <td className="py-1 text-right font-medium text-slate-700">
                    {formatValue(d.value)}
                    {valueSuffix}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </div>
  );
}
