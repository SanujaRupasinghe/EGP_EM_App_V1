import { createClient } from "@/lib/supabase/server";
import { CrudTable, type ColumnConfig } from "@/components/admin/crud-table";
import { CsvImport } from "@/components/admin/csv-import";

const columns: ColumnConfig[] = [
  { key: "effective_from", label: "Effective from", type: "date" },
  { key: "day_rate", label: "Day rate (LKR)", type: "number", step: "1" },
  { key: "free_kg_threshold", label: "Free kg threshold", type: "number", step: "0.1" },
  { key: "extra_kg_rate", label: "Extra LKR / kg", type: "number", step: "1" },
];

const sampleRows = [
  {
    effective_from: "2026-01-01",
    day_rate: "1000",
    free_kg_threshold: "18",
    extra_kg_rate: "50",
  },
];

export default async function RatesAdminPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("pay_rate_settings")
    .select("*")
    .order("effective_from", { ascending: false });

  return (
    <div className="space-y-3">
      <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
        Payroll always uses whichever rate was effective on the day being paid, even for
        past periods. To change a rate going forward, add a new row with today&apos;s (or a
        future) date instead of editing an old one — editing or deleting a past rate
        changes how already-paid days are calculated.
      </p>
      <CsvImport
        table="pay_rate_settings"
        columns={columns}
        identifierKey="effective_from"
        onConflict="effective_from"
        sampleRows={sampleRows}
        templateFilename="pay_rates_template.csv"
      />
      <CrudTable
        key={(data ?? []).map((d) => d.id).join(",")}
        table="pay_rate_settings"
        columns={columns}
        initialRows={data ?? []}
        emptyNewRow={{
          effective_from: new Date().toISOString().slice(0, 10),
          day_rate: 800,
          free_kg_threshold: 18,
          extra_kg_rate: 50,
        }}
      />
    </div>
  );
}
