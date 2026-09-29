"use client";

import { useState } from "react";

export type DayDatum = { date: string; label: string; dayLabel: string; value: number };

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

  if (data.length === 0) {
    return <p className="py-6 text-center text-sm text-slate-400">No data for this range.</p>;
  }

  const max = Math.max(1, ...data.map((d) => d.value));
  const barWidth = 10;
  const gap = 4;
  const plotHeight = 130;
  const axisHeight = 22;
  const topGutter = 16;
  const chartWidth = Math.max(data.length * (barWidth + gap), 320);

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <svg
          role="img"
          aria-label="Daily totals"
          width={chartWidth}
          height={topGutter + plotHeight + axisHeight}
        >
          <line
            x1={0}
            y1={topGutter + plotHeight}
            x2={chartWidth}
            y2={topGutter + plotHeight}
            stroke="#c3c2b7"
            strokeWidth={1}
          />
          {data.map((d, i) => {
            const isHovered = hovered === i;
            const h = d.value === 0 ? 0 : Math.max(2, (d.value / max) * (plotHeight - 4));
            const x = i * (barWidth + gap);
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
                  x={x}
                  y={topGutter}
                  width={barWidth}
                  height={plotHeight}
                  fill="transparent"
                />
                {d.value > 0 ? (
                  <rect
                    x={x}
                    y={y}
                    width={barWidth}
                    height={h}
                    rx={2}
                    fill={isHovered ? "#047857" : "#059669"}
                  />
                ) : (
                  <rect
                    x={x}
                    y={topGutter + plotHeight - 2}
                    width={barWidth}
                    height={2}
                    className="fill-slate-200"
                  />
                )}
                {isHovered && (
                  <text
                    x={x + barWidth / 2}
                    y={Math.max(10, y - 6)}
                    textAnchor="middle"
                    className="fill-slate-900"
                    style={{ fontSize: 10, fontWeight: 600 }}
                  >
                    {d.value > 0 ? d.value.toFixed(0) : "0"}
                  </text>
                )}
                <text
                  x={x + barWidth / 2}
                  y={topGutter + plotHeight + 15}
                  textAnchor="middle"
                  className="fill-slate-400"
                  style={{ fontSize: 9 }}
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
