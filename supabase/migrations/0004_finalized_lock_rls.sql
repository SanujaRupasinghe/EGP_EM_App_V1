-- Once a daily report is submitted (status = 'finalized'), only admins may
-- change it. Previously these policies only checked `report_date = today`,
-- so a non-admin could still write to a finalized "today" report via direct
-- API calls even though the UI locked it (History is now admin-only, and
-- Entry locks itself once submitted). This makes "only admins can change
-- submitted/history data" true in the database, not just the UI.

drop policy daily_reports_update on public.daily_reports;
create policy daily_reports_update on public.daily_reports for update to authenticated
  using ((report_date = public.today_colombo() and status = 'draft') or public.is_admin())
  with check (report_date = public.today_colombo() or public.is_admin());

drop policy attendance_write on public.attendance;
create policy attendance_write on public.attendance for insert to authenticated
  with check (exists (
    select 1 from public.daily_reports dr where dr.id = daily_report_id
      and ((dr.report_date = public.today_colombo() and dr.status = 'draft') or public.is_admin())
  ));
drop policy attendance_update on public.attendance;
create policy attendance_update on public.attendance for update to authenticated
  using (exists (
    select 1 from public.daily_reports dr where dr.id = daily_report_id
      and ((dr.report_date = public.today_colombo() and dr.status = 'draft') or public.is_admin())
  ));
drop policy attendance_delete on public.attendance;
create policy attendance_delete on public.attendance for delete to authenticated
  using (exists (
    select 1 from public.daily_reports dr where dr.id = daily_report_id
      and ((dr.report_date = public.today_colombo() and dr.status = 'draft') or public.is_admin())
  ));

drop policy job_lines_write on public.job_lines;
create policy job_lines_write on public.job_lines for insert to authenticated
  with check (exists (
    select 1 from public.attendance a join public.daily_reports dr on dr.id = a.daily_report_id
    where a.id = attendance_id
      and ((dr.report_date = public.today_colombo() and dr.status = 'draft') or public.is_admin())
  ));
drop policy job_lines_update on public.job_lines;
create policy job_lines_update on public.job_lines for update to authenticated
  using (exists (
    select 1 from public.attendance a join public.daily_reports dr on dr.id = a.daily_report_id
    where a.id = attendance_id
      and ((dr.report_date = public.today_colombo() and dr.status = 'draft') or public.is_admin())
  ));
drop policy job_lines_delete on public.job_lines;
create policy job_lines_delete on public.job_lines for delete to authenticated
  using (exists (
    select 1 from public.attendance a join public.daily_reports dr on dr.id = a.daily_report_id
    where a.id = attendance_id
      and ((dr.report_date = public.today_colombo() and dr.status = 'draft') or public.is_admin())
  ));

drop policy transport_log_write on public.transport_log;
create policy transport_log_write on public.transport_log for insert to authenticated
  with check (exists (
    select 1 from public.daily_reports dr where dr.id = daily_report_id
      and ((dr.report_date = public.today_colombo() and dr.status = 'draft') or public.is_admin())
  ));
drop policy transport_log_update on public.transport_log;
create policy transport_log_update on public.transport_log for update to authenticated
  using (exists (
    select 1 from public.daily_reports dr where dr.id = daily_report_id
      and ((dr.report_date = public.today_colombo() and dr.status = 'draft') or public.is_admin())
  ));

drop policy tea_collector_write on public.tea_collector;
create policy tea_collector_write on public.tea_collector for insert to authenticated
  with check (exists (
    select 1 from public.daily_reports dr where dr.id = daily_report_id
      and ((dr.report_date = public.today_colombo() and dr.status = 'draft') or public.is_admin())
  ));
drop policy tea_collector_update on public.tea_collector;
create policy tea_collector_update on public.tea_collector for update to authenticated
  using (exists (
    select 1 from public.daily_reports dr where dr.id = daily_report_id
      and ((dr.report_date = public.today_colombo() and dr.status = 'draft') or public.is_admin())
  ));

drop policy cash_summary_write on public.cash_summary;
create policy cash_summary_write on public.cash_summary for insert to authenticated
  with check (exists (
    select 1 from public.daily_reports dr where dr.id = daily_report_id
      and ((dr.report_date = public.today_colombo() and dr.status = 'draft') or public.is_admin())
  ));
drop policy cash_summary_update on public.cash_summary;
create policy cash_summary_update on public.cash_summary for update to authenticated
  using (exists (
    select 1 from public.daily_reports dr where dr.id = daily_report_id
      and ((dr.report_date = public.today_colombo() and dr.status = 'draft') or public.is_admin())
  ));
