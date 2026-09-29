import { createClient } from "@/lib/supabase/server";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { AuditLogRow, Profile } from "@/lib/supabase/types";

export default async function AuditLogPage() {
  const supabase = await createClient();
  const [{ data: logs }, { data: profiles }] = await Promise.all([
    supabase
      .from("audit_log")
      .select("*")
      .order("changed_at", { ascending: false })
      .limit(200),
    supabase.from("profiles").select("*"),
  ]);

  const nameById = new Map((profiles as Profile[] | null)?.map((p) => [p.id, p.full_name]));

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500">Most recent 200 changes across all reports.</p>
      {(logs as AuditLogRow[] | null)?.map((log) => (
        <Card key={log.id}>
          <CardBody>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <Badge tone={log.action === "DELETE" ? "red" : log.action === "INSERT" ? "green" : "amber"}>
                {log.action}
              </Badge>
              <span className="font-medium text-slate-700">{log.table_name}</span>
              <span>{new Date(log.changed_at).toLocaleString("en-LK")}</span>
              <span>by {(log.changed_by && nameById.get(log.changed_by)) ?? "system"}</span>
            </div>
            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-emerald-700">View diff</summary>
              <pre className="mt-1 max-h-64 overflow-auto rounded bg-slate-50 p-2 text-[11px]">
                {JSON.stringify(log.diff, null, 2)}
              </pre>
            </details>
          </CardBody>
        </Card>
      ))}
      {(!logs || logs.length === 0) && (
        <p className="text-sm text-slate-500">No changes recorded yet.</p>
      )}
    </div>
  );
}
