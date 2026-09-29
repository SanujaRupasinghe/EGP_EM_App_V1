"use client";

import { useId, useState } from "react";

export type DayDatum = { date: string; label: string; dayLabel: string; value: number };

function formatAxisValue(v: number): string {
  if (v >= 1000) return `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k`;
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

export function DailyTrendChart({
  data,
  valueSuffix = " kg",
  showTable = true,
}: {
  data: DayDatum[];
  valueSuffix?: string;
  showTable?: boolean;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const gradientId = useId();

  if (data.length === 0) {
    return <p className="py-6 text-center text-sm text-slate-400">No data for this range.</p>;
  }

  const hasAnyData = data.some((d) => d.value > 0);
  const max = Math.max(1, ...data.map((d) => d.value));
  const barWidth = 12;
  const gap = 6;
  const plotHeight = 140;
  const axisHeight = 22;
  const topGutter = 20;
  const leftGutter = 34;
  const chartWidth = leftGutter + Math.max(data.length * (barWidth + gap), 300);
  const chartHeight = topGutter + plotHeight + axisHeight;
  const gridSteps = 4;

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-lg bg-slate-50/60 px-1 py-2">
        <svg
          role="img"
          aria-label="Daily totals"
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

          {!hasAnyData && (
            <text
              x={leftGutter + (chartWidth - leftGutter) / 2}
              y={topGutter + plotHeight / 2}
              textAnchor="middle"
              className="fill-slate-300"
              style={{ fontSize: 11, fontWeight: 500 }}
            >
              No work recorded in this range
            </text>
          )}

          {data.map((d, i) => {
            const isHovered = hovered === i;
            const h = d.value === 0 ? 0 : Math.max(2, (d.value / max) * plotHeight);
            const x = leftGutter + i * (barWidth + gap);
            const y = topGutter + plotHeight - h;
            return (
              <g
                key={d.date}
                tabIndex={0}
                onPointerEnter={() => setHovered(i)}
                onPointerLeave={() => setHovered(null)}
                onFocus={() => setHovered(i)}
                onBlur={() => setHovered(null)}
                style={{ cursor: "pointer", outline: "none" }}
              >
                <title>{`${d.label}: ${d.value > 0 ? `${d.value.toFixed(1)}${valueSuffix}` : "No work recorded"}`}</title>
                <rect
                  x={x - gap / 2}
                  y={topGutter}
                  width={barWidth + gap}
                  height={plotHeight}
                  rx={4}
                  fill={isHovered ? "#0f766e0d" : "transparent"}
                />
                {d.value > 0 ? (
                  <rect
                    x={x}
                    y={y}
                    width={barWidth}
                    height={h}
                    rx={3}
                    fill={isHovered ? "#065f46" : `url(#${gradientId})`}
                  />
                ) : (
                  <circle
                    cx={x + barWidth / 2}
                    cy={topGutter + plotHeight}
                    r={1.5}
                    className="fill-slate-300"
                  />
                )}
                {isHovered && d.value > 0 && (
                  <text
                    x={x + barWidth / 2}
                    y={Math.max(topGutter - 4, y - 6)}
                    textAnchor="middle"
                    className="fill-slate-900"
                    style={{ fontSize: 10, fontWeight: 700 }}
                  >
                    {d.value.toFixed(0)}
                  </text>
                )}
                <text
                  x={x + barWidth / 2}
                  y={topGutter + plotHeight + 15}
                  textAnchor="middle"
                  className={isHovered ? "fill-slate-700" : "fill-slate-400"}
                  style={{ fontSize: 9, fontWeight: isHovered ? 700 : 400 }}
                >
                  {d.dayLabel}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      {showTable && (
        <details className="text-xs text-slate-500">
          <summary className="cursor-pointer select-none">Show as table</summary>
          <div className="mt-2 max-h-48 overflow-y-auto">
            <table className="w-full text-left">
              <tbody>
                {data.map((d) => (
                  <tr key={d.date} className="border-b border-slate-100">
                    <td className="py-1 pr-2">{d.label}</td>
                    <td className="py-1 text-right font-medium text-slate-700">
                      {d.value > 0 ? `${d.value.toFixed(1)}${valueSuffix}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  );
}
