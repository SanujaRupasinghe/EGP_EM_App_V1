-- Holidays: admin can mark specific dates in advance (estate closed, Poya
-- day, etc.) so office staff can't create or edit that day's report at all.
-- Admins can still override, same as the other date-lock rules.

create table public.holidays (
  id uuid primary key default gen_random_uuid(),
  date date not null unique,
  reason text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

alter table public.holidays enable row level security;

create policy holidays_select on public.holidays for select to authenticated using (true);
create policy holidays_admin_insert on public.holidays for insert to authenticated with check (public.is_admin());
create policy holidays_admin_update on public.holidays for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy holidays_admin_delete on public.holidays for delete to authenticated using (public.is_admin());

create or replace function public.is_holiday(d date)
returns boolean
language sql
stable
as $$
  select exists (select 1 from public.holidays h where h.date = d);
$$;

-- Re-scope the "today + draft" write policies (from 0004) to also exclude
-- holidays for non-admins.

drop policy daily_reports_insert on public.daily_reports;
create policy daily_reports_insert on public.daily_reports for insert to authenticated
  with check (
    (report_date = public.today_colombo() and not public.is_holiday(report_date))
    or public.is_admin()
  );

drop policy daily_reports_update on public.daily_reports;
create policy daily_reports_update on public.daily_reports for update to authenticated
  using (
    (report_date = public.today_colombo() and status = 'draft' and not public.is_holiday(report_date))
    or public.is_admin()
  )
  with check (
    (report_date = public.today_colombo() and not public.is_holiday(report_date))
    or public.is_admin()
  );

drop policy attendance_write on public.attendance;
create policy attendance_write on public.attendance for insert to authenticated
  with check (exists (
    select 1 from public.daily_reports dr where dr.id = daily_report_id
      and (
        (dr.report_date = public.today_colombo() and dr.status = 'draft' and not public.is_holiday(dr.report_date))
        or public.is_admin()
      )
  ));
drop policy attendance_update on public.attendance;
create policy attendance_update on public.attendance for update to authenticated
  using (exists (
    select 1 from public.daily_reports dr where dr.id = daily_report_id
      and (
        (dr.report_date = public.today_colombo() and dr.status = 'draft' and not public.is_holiday(dr.report_date))
        or public.is_admin()
      )
  ));
drop policy attendance_delete on public.attendance;
create policy attendance_delete on public.attendance for delete to authenticated
  using (exists (
    select 1 from public.daily_reports dr where dr.id = daily_report_id
      and (
        (dr.report_date = public.today_colombo() and dr.status = 'draft' and not public.is_holiday(dr.report_date))
        or public.is_admin()
      )
  ));

drop policy job_lines_write on public.job_lines;
create policy job_lines_write on public.job_lines for insert to authenticated
  with check (exists (
    select 1 from public.attendance a join public.daily_reports dr on dr.id = a.daily_report_id
    where a.id = attendance_id
      and (
        (dr.report_date = public.today_colombo() and dr.status = 'draft' and not public.is_holiday(dr.report_date))
        or public.is_admin()
      )
  ));
drop policy job_lines_update on public.job_lines;
create policy job_lines_update on public.job_lines for update to authenticated
  using (exists (
    select 1 from public.attendance a join public.daily_reports dr on dr.id = a.daily_report_id
    where a.id = attendance_id
      and (
        (dr.report_date = public.today_colombo() and dr.status = 'draft' and not public.is_holiday(dr.report_date))
        or public.is_admin()
      )
  ));
drop policy job_lines_delete on public.job_lines;
create policy job_lines_delete on public.job_lines for delete to authenticated
  using (exists (
    select 1 from public.attendance a join public.daily_reports dr on dr.id = a.daily_report_id
    where a.id = attendance_id
      and (
        (dr.report_date = public.today_colombo() and dr.status = 'draft' and not public.is_holiday(dr.report_date))
        or public.is_admin()
      )
  ));

drop policy transport_log_write on public.transport_log;
create policy transport_log_write on public.transport_log for insert to authenticated
  with check (exists (
    select 1 from public.daily_reports dr where dr.id = daily_report_id
      and (
        (dr.report_date = public.today_colombo() and dr.status = 'draft' and not public.is_holiday(dr.report_date))
        or public.is_admin()
      )
  ));
drop policy transport_log_update on public.transport_log;
create policy transport_log_update on public.transport_log for update to authenticated
  using (exists (
    select 1 from public.daily_reports dr where dr.id = daily_report_id
      and (
        (dr.report_date = public.today_colombo() and dr.status = 'draft' and not public.is_holiday(dr.report_date))
        or public.is_admin()
      )
  ));

drop policy tea_collector_write on public.tea_collector;
create policy tea_collector_write on public.tea_collector for insert to authenticated
  with check (exists (
    select 1 from public.daily_reports dr where dr.id = daily_report_id
      and (
        (dr.report_date = public.today_colombo() and dr.status = 'draft' and not public.is_holiday(dr.report_date))
        or public.is_admin()
      )
  ));
drop policy tea_collector_update on public.tea_collector;
create policy tea_collector_update on public.tea_collector for update to authenticated
  using (exists (
    select 1 from public.daily_reports dr where dr.id = daily_report_id
      and (
        (dr.report_date = public.today_colombo() and dr.status = 'draft' and not public.is_holiday(dr.report_date))
        or public.is_admin()
      )
  ));

drop policy cash_summary_write on public.cash_summary;
create policy cash_summary_write on public.cash_summary for insert to authenticated
  with check (exists (
    select 1 from public.daily_reports dr where dr.id = daily_report_id
      and (
        (dr.report_date = public.today_colombo() and dr.status = 'draft' and not public.is_holiday(dr.report_date))
        or public.is_admin()
      )
  ));
drop policy cash_summary_update on public.cash_summary;
create policy cash_summary_update on public.cash_summary for update to authenticated
  using (exists (
    select 1 from public.daily_reports dr where dr.id = daily_report_id
      and (
        (dr.report_date = public.today_colombo() and dr.status = 'draft' and not public.is_holiday(dr.report_date))
        or public.is_admin()
      )
  ));
