import { type ComponentType } from "react";
import { cn } from "@/lib/utils";

export function StatTile({
  label,
  value,
  hint,
  icon: Icon,
  className,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: ComponentType<{ className?: string }>;
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl border border-slate-200 bg-white p-4 shadow-sm", className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        {Icon && (
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
            <Icon className="h-4 w-4" />
          </span>
        )}
      </div>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}
