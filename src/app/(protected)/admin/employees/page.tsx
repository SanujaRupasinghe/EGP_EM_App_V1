import { createClient } from "@/lib/supabase/server";
import { CrudTable, type ColumnConfig } from "@/components/admin/crud-table";
import { CsvImport } from "@/components/admin/csv-import";

const columns: ColumnConfig[] = [
  { key: "code", label: "Code", type: "text" },
  { key: "name", label: "Name", type: "text" },
  {
    key: "gender",
    label: "Gender",
    type: "text",
  },
  { key: "active", label: "Active", type: "boolean" },
];

const sampleRows = [
  { code: "EMP-101", name: "Kamala Perera", gender: "F", active: "true" },
  { code: "EMP-102", name: "Sunil Fernando", gender: "M", active: "true" },
];

export default async function EmployeesAdminPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("employees").select("*").order("code");

  return (
    <div className="space-y-3">
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          Couldn&apos;t load employees: {error.message}
        </p>
      )}
      <CsvImport
        table="employees"
        columns={columns}
        identifierKey="code"
        onConflict="code"
        sampleRows={sampleRows}
        templateFilename="employees_template.csv"
      />
      <CrudTable
        key={(data ?? []).map((d) => d.id).join(",")}
        table="employees"
        columns={columns}
        initialRows={data ?? []}
        emptyNewRow={{ code: "", name: "", gender: "F", active: true }}
      />
    </div>
  );
}
