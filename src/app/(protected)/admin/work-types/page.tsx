import { createClient } from "@/lib/supabase/server";
import { CrudTable, type ColumnConfig } from "@/components/admin/crud-table";
import { CsvImport } from "@/components/admin/csv-import";

const columns: ColumnConfig[] = [
  { key: "code", label: "Code", type: "text" },
  { key: "requires_quantity", label: "Needs kg entry", type: "boolean" },
  { key: "active", label: "Active", type: "boolean" },
];

const sampleRows = [
  { code: "PLUCKING", requires_quantity: "true", active: "true" },
  { code: "WEEDING", requires_quantity: "false", active: "true" },
];

export default async function WorkTypesAdminPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("work_types").select("*").order("code");

  return (
    <div className="space-y-3">
      <CsvImport
        table="work_types"
        columns={columns}
        identifierKey="code"
        onConflict="code"
        sampleRows={sampleRows}
        templateFilename="work_types_template.csv"
      />
      <CrudTable
        key={(data ?? []).map((d) => d.id).join(",")}
        table="work_types"
        columns={columns}
        initialRows={data ?? []}
        emptyNewRow={{ code: "", requires_quantity: false, active: true }}
      />
    </div>
  );
}
