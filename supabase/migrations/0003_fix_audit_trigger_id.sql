-- fn_audit_log() assumed every audited table has an `id` column
-- (`coalesce(new.id, old.id)`), but transport_log, tea_collector and
-- cash_summary are keyed by `daily_report_id` instead and have no `id`
-- column at all. Any insert/update/delete on those three tables raised
-- "record \"new\" has no field \"id\"" and rolled back — meaning every save
-- of the Transport Log / Tea Collector / Cash Summary sections of the daily
-- report has always failed. Read the id generically via to_jsonb() so the
-- same trigger function works for both id-keyed and daily_report_id-keyed
-- tables.

create or replace function public.fn_audit_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  rec_json jsonb := to_jsonb(coalesce(new, old));
begin
  insert into public.audit_log (table_name, record_id, action, diff, changed_by)
  values (
    tg_table_name,
    coalesce(
      (rec_json->>'id')::uuid,
      (rec_json->>'daily_report_id')::uuid
    ),
    tg_op,
    case
      when tg_op = 'DELETE' then to_jsonb(old)
      when tg_op = 'UPDATE' then jsonb_build_object('before', to_jsonb(old), 'after', to_jsonb(new))
      else to_jsonb(new)
    end,
    auth.uid()
  );
  return coalesce(new, old);
end;
$$;
