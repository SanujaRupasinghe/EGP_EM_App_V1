"use client";

import { useState } from "react";

export type BarDatum = { label: string; value: number };

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

  if (data.length === 0) {
    return <p className="py-6 text-center text-sm text-slate-400">{emptyLabel}</p>;
  }

  const formatValue = (v: number) =>
    v.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

  const max = Math.max(1, ...data.map((d) => d.value));
  const barWidth = 28;
  const gap = 20;
  const plotHeight = 160;
  const topGutter = 20;
  const labelGutter = 52;
  const chartWidth = Math.max(data.length * (barWidth + gap), 320);
  const chartHeight = topGutter + plotHeight + labelGutter;

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <svg
          role="img"
          aria-label="Bar chart"
          width={chartWidth}
          height={chartHeight}
        >
          <line
            x1={0}
            y1={topGutter + plotHeight}
            x2={chartWidth}
            y2={topGutter + plotHeight}
            stroke="#e2e8f0"
            strokeWidth={1}
          />
          {data.map((d, i) => {
            const w = Math.max(2, (d.value / max) * (plotHeight - 4));
            const x = i * (barWidth + gap) + gap / 2;
            const y = topGutter + plotHeight - w;
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
                <rect x={x} y={topGutter} width={barWidth} height={plotHeight} fill="transparent" />
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={w}
                  rx={4}
                  fill={isHovered ? "#047857" : "#059669"}
                />
                <text
                  x={labelX}
                  y={Math.max(12, y - 6)}
                  textAnchor="middle"
                  className="fill-slate-900"
                  style={{ fontSize: 10, fontWeight: 600 }}
                >
                  {formatValue(d.value)}
                  {valueSuffix}
                </text>
                <text
                  x={labelX}
                  y={labelY}
                  textAnchor="end"
                  className="fill-slate-600"
                  style={{ fontSize: 10 }}
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
