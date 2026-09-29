-- Itemized cash entries: each income or expense gets its own reason (e.g.
-- "From bank", "From tea collector", "Advance payment", "Loan given",
-- "Groceries") instead of one shared free-text description for the whole
-- day. cash_summary.receive/expenses/balance stay as the day's totals,
-- recomputed by the app from these rows whenever one changes.

create table public.cash_entries (
  id uuid primary key default gen_random_uuid(),
  daily_report_id uuid not null references public.daily_reports(id) on delete cascade,
  type text not null check (type in ('income', 'expense')),
  reason text not null default '',
  amount numeric(10, 2) not null default 0,
  created_at timestamptz not null default now()
);

alter table public.cash_entries enable row level security;

create policy cash_entries_select on public.cash_entries for select to authenticated using (true);

create policy cash_entries_write on public.cash_entries for insert to authenticated
  with check (exists (
    select 1 from public.daily_reports dr where dr.id = daily_report_id
      and (
        (dr.report_date = public.today_colombo() and dr.status = 'draft' and not public.is_holiday(dr.report_date))
        or public.is_admin()
      )
  ));

create policy cash_entries_update on public.cash_entries for update to authenticated
  using (exists (
    select 1 from public.daily_reports dr where dr.id = daily_report_id
      and (
        (dr.report_date = public.today_colombo() and dr.status = 'draft' and not public.is_holiday(dr.report_date))
        or public.is_admin()
      )
  ));

create policy cash_entries_delete on public.cash_entries for delete to authenticated
  using (exists (
    select 1 from public.daily_reports dr where dr.id = daily_report_id
      and (
        (dr.report_date = public.today_colombo() and dr.status = 'draft' and not public.is_holiday(dr.report_date))
        or public.is_admin()
      )
  ));

create trigger trg_audit_cash_entries
  after insert or update or delete on public.cash_entries
  for each row execute function public.fn_audit_log();
