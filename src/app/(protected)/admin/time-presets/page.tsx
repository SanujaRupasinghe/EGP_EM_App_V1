import { createClient } from "@/lib/supabase/server";
import { CrudTable, type ColumnConfig } from "@/components/admin/crud-table";
import { CsvImport } from "@/components/admin/csv-import";

const columns: ColumnConfig[] = [
  { key: "label", label: "Label", type: "text" },
  { key: "start_time", label: "Start", type: "time" },
  { key: "end_time", label: "End", type: "time" },
  { key: "day_fraction", label: "Day fraction", type: "number", step: "0.1" },
  { key: "active", label: "Active", type: "boolean" },
];

const sampleRows = [
  {
    label: "Full Day",
    start_time: "07:30",
    end_time: "16:30",
    day_fraction: "1",
    active: "true",
  },
  {
    label: "Half Day",
    start_time: "07:30",
    end_time: "12:30",
    day_fraction: "0.5",
    active: "true",
  },
];

export default async function TimePresetsAdminPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("time_presets").select("*").order("start_time");

  return (
    <div className="space-y-3">
      <CsvImport
        table="time_presets"
        columns={columns}
        identifierKey="label"
        sampleRows={sampleRows}
        templateFilename="time_presets_template.csv"
        existing={(data ?? []).map((d) => d.label)}
      />
      <CrudTable
        key={(data ?? []).map((d) => d.id).join(",")}
        table="time_presets"
        columns={columns}
        initialRows={data ?? []}
        emptyNewRow={{
          label: "",
          start_time: "07:30",
          end_time: "13:30",
          day_fraction: 1,
          active: true,
        }}
      />
    </div>
  );
}
