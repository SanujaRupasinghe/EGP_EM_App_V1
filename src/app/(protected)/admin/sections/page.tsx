import { createClient } from "@/lib/supabase/server";
import { CrudTable, type ColumnConfig } from "@/components/admin/crud-table";
import { CsvImport } from "@/components/admin/csv-import";

const columns: ColumnConfig[] = [
  { key: "code", label: "Code", type: "text" },
  { key: "area_acres", label: "Area (acres)", type: "number", step: "0.01" },
  { key: "active", label: "Active", type: "boolean" },
];

const sampleRows = [
  { code: "SEC-A", area_acres: "2.5", active: "true" },
  { code: "SEC-B", area_acres: "1.8", active: "true" },
];

export default async function SectionsAdminPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("sections").select("*").order("code");

  return (
    <div className="space-y-3">
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          Couldn&apos;t load sections: {error.message}
        </p>
      )}
      <CsvImport
        table="sections"
        columns={columns}
        identifierKey="code"
        onConflict="code"
        sampleRows={sampleRows}
        templateFilename="sections_template.csv"
      />
      <CrudTable
        key={(data ?? []).map((d) => d.id).join(",")}
        table="sections"
        columns={columns}
        initialRows={data ?? []}
        emptyNewRow={{ code: "", area_acres: null, active: true }}
      />
    </div>
  );
}
