-- office_v2: an office user who can also back-fill PAST days that have no
-- entry yet. Everything an office user can do today still applies; on top of
-- that, for a past date (< today) an office_v2 user may either
--   * mark it as a holiday, or
--   * create the day's report and fill it in (draft -> submit).
-- Once they submit it (or if anything else already exists for that date) the
-- day is locked for them — only admins can change it afterwards. They can
-- never edit an existing report they didn't create, delete reports, or touch
-- master data. All of this is additive (permissive policies are OR'd), so the
-- existing office/admin policies are untouched.

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check check (role in ('admin', 'office', 'office_v2'));

create or replace function public.is_office_v2()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'office_v2'
  );
$$;

-- True while an office_v2 user may still write to this report: a past-dated,
-- still-draft, non-holiday report that they created themselves.
create or replace function public.office_v2_can_edit_report(p_report_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_office_v2() and exists (
    select 1 from public.daily_reports dr
    where dr.id = p_report_id
      and dr.report_date < public.today_colombo()
      and dr.status = 'draft'
      and dr.created_by = auth.uid()
      and not public.is_holiday(dr.report_date)
  );
$$;

-- Holidays: a past date with no report yet.
create policy holidays_office_v2_insert on public.holidays for insert to authenticated
  with check (
    public.is_office_v2()
    and date < public.today_colombo()
    and not exists (select 1 from public.daily_reports dr where dr.report_date = date)
  );

-- daily_reports
create policy daily_reports_office_v2_insert on public.daily_reports for insert to authenticated
  with check (
    public.is_office_v2()
    and report_date < public.today_colombo()
    and not public.is_holiday(report_date)
    and status = 'draft'
    and created_by = auth.uid()
  );
create policy daily_reports_office_v2_update on public.daily_reports for update to authenticated
  using (
    public.is_office_v2()
    and report_date < public.today_colombo()
    and status = 'draft'
    and created_by = auth.uid()
    and not public.is_holiday(report_date)
  )
  with check (
    public.is_office_v2()
    and report_date < public.today_colombo()
    and created_by = auth.uid()
  );

-- attendance
create policy attendance_office_v2_insert on public.attendance for insert to authenticated
  with check (public.office_v2_can_edit_report(daily_report_id));
create policy attendance_office_v2_update on public.attendance for update to authenticated
  using (public.office_v2_can_edit_report(daily_report_id));
create policy attendance_office_v2_delete on public.attendance for delete to authenticated
  using (public.office_v2_can_edit_report(daily_report_id));

-- job_lines (via attendance)
create policy job_lines_office_v2_insert on public.job_lines for insert to authenticated
  with check (exists (
    select 1 from public.attendance a
    where a.id = attendance_id and public.office_v2_can_edit_report(a.daily_report_id)
  ));
create policy job_lines_office_v2_update on public.job_lines for update to authenticated
  using (exists (
    select 1 from public.attendance a
    where a.id = attendance_id and public.office_v2_can_edit_report(a.daily_report_id)
  ));
create policy job_lines_office_v2_delete on public.job_lines for delete to authenticated
  using (exists (
    select 1 from public.attendance a
    where a.id = attendance_id and public.office_v2_can_edit_report(a.daily_report_id)
  ));

-- transport_log / tea_collector / cash_summary
create policy transport_log_office_v2_insert on public.transport_log for insert to authenticated
  with check (public.office_v2_can_edit_report(daily_report_id));
create policy transport_log_office_v2_update on public.transport_log for update to authenticated
  using (public.office_v2_can_edit_report(daily_report_id));

create policy tea_collector_office_v2_insert on public.tea_collector for insert to authenticated
  with check (public.office_v2_can_edit_report(daily_report_id));
create policy tea_collector_office_v2_update on public.tea_collector for update to authenticated
  using (public.office_v2_can_edit_report(daily_report_id));

create policy cash_summary_office_v2_insert on public.cash_summary for insert to authenticated
  with check (public.office_v2_can_edit_report(daily_report_id));
create policy cash_summary_office_v2_update on public.cash_summary for update to authenticated
  using (public.office_v2_can_edit_report(daily_report_id));

-- cash_entries
create policy cash_entries_office_v2_insert on public.cash_entries for insert to authenticated
  with check (public.office_v2_can_edit_report(daily_report_id));
create policy cash_entries_office_v2_update on public.cash_entries for update to authenticated
  using (public.office_v2_can_edit_report(daily_report_id));
create policy cash_entries_office_v2_delete on public.cash_entries for delete to authenticated
  using (public.office_v2_can_edit_report(daily_report_id));
