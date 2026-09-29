-- A holiday and a saved report for the same date don't coexist. This used to
-- be enforced only in the History page's "mark as holiday" action, so a
-- holiday added any other way (the Admin -> Holidays table, its CSV import)
-- could leave that date's report data orphaned. Enforce it in the database
-- instead, for every insert path.

create or replace function public.delete_report_on_holiday()
returns trigger
language plpgsql
as $$
begin
  delete from public.daily_reports where report_date = new.date;
  return new;
end;
$$;

create trigger trg_delete_report_on_holiday
  after insert on public.holidays
  for each row
  execute function public.delete_report_on_holiday();
