import { createClient } from "@/lib/supabase/server";
import { CrudTable, type ColumnConfig } from "@/components/admin/crud-table";
import { CsvImport } from "@/components/admin/csv-import";

const columns: ColumnConfig[] = [
  { key: "date", label: "Date", type: "date" },
  { key: "reason", label: "Reason", type: "text" },
];

const sampleRows = [
  { date: "2026-04-13", reason: "New Year" },
  { date: "2026-04-14", reason: "New Year" },
];

export default async function HolidaysAdminPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("holidays").select("*").order("date");

  return (
    <div className="space-y-3">
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          Couldn&apos;t load holidays: {error.message}
        </p>
      )}
      <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
        Any date listed here is locked for office staff — they can&apos;t create or edit
        that day&apos;s report on Today or History. Admins can still enter or amend it.
      </p>
      <CsvImport
        table="holidays"
        columns={columns}
        identifierKey="date"
        onConflict="date"
        sampleRows={sampleRows}
        templateFilename="holidays_template.csv"
      />
      <CrudTable
        key={(data ?? []).map((d) => d.id).join(",")}
        table="holidays"
        columns={columns}
        initialRows={data ?? []}
        emptyNewRow={{ date: "", reason: "" }}
      />
    </div>
  );
}
