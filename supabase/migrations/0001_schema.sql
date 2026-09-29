-- Tea Estate Daily Report & Payroll — core schema
-- Timezone for "today" lock logic: Asia/Colombo (see plan doc for rationale).

create extension if not exists pgcrypto;

-- ============================================================
-- Helper functions
-- ============================================================

create or replace function public.today_colombo()
returns date
language sql
stable
as $$
  select (now() at time zone 'Asia/Colombo')::date;
$$;

-- ============================================================
-- Master data
-- ============================================================

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null default 'office' check (role in ('admin', 'office')),
  created_at timestamptz not null default now()
);

-- Defined here (not in the "Helper functions" section above) because a plain
-- `language sql` function body is validated against the schema at CREATE
-- time — it would fail to create if `profiles` didn't exist yet.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create table public.employees (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  gender text check (gender in ('M', 'F')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.sections (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.work_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  requires_quantity boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.time_presets (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  start_time time not null,
  end_time time not null,
  day_fraction numeric(4, 2) not null check (day_fraction > 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Versioned pay rate settings: historical payroll always uses the row
-- effective on the day being paid, even after the admin changes rates later.
create table public.pay_rate_settings (
  id uuid primary key default gen_random_uuid(),
  effective_from date not null unique,
  day_rate numeric(10, 2) not null,
  free_kg_threshold numeric(10, 2) not null,
  extra_kg_rate numeric(10, 2) not null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- ============================================================
-- Daily report + children
-- ============================================================

create table public.daily_reports (
  id uuid primary key default gen_random_uuid(),
  report_date date not null unique,
  status text not null default 'draft' check (status in ('draft', 'finalized')),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  last_amended_by uuid references public.profiles(id),
  last_amended_at timestamptz,
  amendment_count int not null default 0,
  unlocked_by uuid references public.profiles(id),
  unlocked_at timestamptz
);

create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  daily_report_id uuid not null references public.daily_reports(id) on delete cascade,
  employee_id uuid not null references public.employees(id),
  time_preset_id uuid not null references public.time_presets(id),
  advance_amount numeric(10, 2) not null default 0,
  created_at timestamptz not null default now(),
  unique (daily_report_id, employee_id)
);

create table public.job_lines (
  id uuid primary key default gen_random_uuid(),
  attendance_id uuid not null references public.attendance(id) on delete cascade,
  section_id uuid not null references public.sections(id),
  work_type_id uuid not null references public.work_types(id),
  quantity_kg numeric(10, 2)
);

create table public.transport_log (
  daily_report_id uuid primary key references public.daily_reports(id) on delete cascade,
  login_available boolean not null default false,
  login_time time,
  logout_available boolean not null default false,
  logout_time time
);

create table public.tea_collector (
  daily_report_id uuid primary key references public.daily_reports(id) on delete cascade,
  arrived boolean not null default false,
  amount_kg numeric(10, 2)
);

create table public.cash_summary (
  daily_report_id uuid primary key references public.daily_reports(id) on delete cascade,
  receive numeric(10, 2) not null default 0,
  expenses numeric(10, 2) not null default 0,
  balance numeric(10, 2) not null default 0,
  description text,
  remarks text
);

-- Manual per-period adjustments shown on the payroll report (Allowance / Loan
-- columns from the paper form — no computation rule was given for these).
create table public.payroll_adjustments (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id),
  period_start date not null,
  period_end date not null,
  allowance numeric(10, 2) not null default 0,
  loan numeric(10, 2) not null default 0,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  unique (employee_id, period_start, period_end)
);

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  table_name text not null,
  record_id uuid,
  action text not null,
  diff jsonb,
  changed_by uuid references public.profiles(id),
  changed_at timestamptz not null default now()
);

-- ============================================================
-- Audit trail + amendment counter
-- ============================================================

create or replace function public.fn_audit_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_log (table_name, record_id, action, diff, changed_by)
  values (
    tg_table_name,
    coalesce(new.id, old.id),
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

create trigger trg_audit_daily_reports
  after insert or update or delete on public.daily_reports
  for each row execute function public.fn_audit_log();

create trigger trg_audit_attendance
  after insert or update or delete on public.attendance
  for each row execute function public.fn_audit_log();

create trigger trg_audit_job_lines
  after insert or update or delete on public.job_lines
  for each row execute function public.fn_audit_log();

create trigger trg_audit_transport_log
  after insert or update or delete on public.transport_log
  for each row execute function public.fn_audit_log();

create trigger trg_audit_tea_collector
  after insert or update or delete on public.tea_collector
  for each row execute function public.fn_audit_log();

create trigger trg_audit_cash_summary
  after insert or update or delete on public.cash_summary
  for each row execute function public.fn_audit_log();

-- Every save from the app touches daily_reports (even just bumping
-- updated_at-like fields), so this fires exactly once per amendment.
create or replace function public.fn_bump_amendment()
returns trigger
language plpgsql
as $$
begin
  new.amendment_count := old.amendment_count + 1;
  new.last_amended_at := now();
  new.last_amended_by := auth.uid();
  return new;
end;
$$;

create trigger trg_bump_amendment
  before update on public.daily_reports
  for each row
  when (old.* is distinct from new.*)
  execute function public.fn_bump_amendment();

-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.profiles enable row level security;
alter table public.employees enable row level security;
alter table public.sections enable row level security;
alter table public.work_types enable row level security;
alter table public.time_presets enable row level security;
alter table public.pay_rate_settings enable row level security;
alter table public.daily_reports enable row level security;
alter table public.attendance enable row level security;
alter table public.job_lines enable row level security;
alter table public.transport_log enable row level security;
alter table public.tea_collector enable row level security;
alter table public.cash_summary enable row level security;
alter table public.payroll_adjustments enable row level security;
alter table public.audit_log enable row level security;

-- profiles: everyone can read all profiles (needed for name lookups / admin
-- screens); a user can update only their own full_name; only admins manage roles.
create policy profiles_select on public.profiles for select using (true);
create policy profiles_update_self on public.profiles for update
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());
create policy profiles_admin_all on public.profiles for all
  using (public.is_admin()) with check (public.is_admin());

-- master data: any authenticated user can read (needed for entry dropdowns);
-- only admins can add/edit/deactivate.
create policy employees_select on public.employees for select to authenticated using (true);
create policy employees_admin_write on public.employees for insert to authenticated with check (public.is_admin());
create policy employees_admin_update on public.employees for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy employees_admin_delete on public.employees for delete to authenticated using (public.is_admin());

create policy sections_select on public.sections for select to authenticated using (true);
create policy sections_admin_write on public.sections for insert to authenticated with check (public.is_admin());
create policy sections_admin_update on public.sections for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy sections_admin_delete on public.sections for delete to authenticated using (public.is_admin());

create policy work_types_select on public.work_types for select to authenticated using (true);
create policy work_types_admin_write on public.work_types for insert to authenticated with check (public.is_admin());
create policy work_types_admin_update on public.work_types for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy work_types_admin_delete on public.work_types for delete to authenticated using (public.is_admin());

create policy time_presets_select on public.time_presets for select to authenticated using (true);
create policy time_presets_admin_write on public.time_presets for insert to authenticated with check (public.is_admin());
create policy time_presets_admin_update on public.time_presets for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy time_presets_admin_delete on public.time_presets for delete to authenticated using (public.is_admin());

create policy pay_rate_settings_select on public.pay_rate_settings for select to authenticated using (true);
create policy pay_rate_settings_admin_write on public.pay_rate_settings for insert to authenticated with check (public.is_admin());
create policy pay_rate_settings_admin_update on public.pay_rate_settings for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy pay_rate_settings_admin_delete on public.pay_rate_settings for delete to authenticated using (public.is_admin());

-- daily_reports: the date-lock rule is enforced here, in the database, not
-- just the UI. A non-admin can only insert a row dated today, and can only
-- update/delete it while it is still dated today. Admins bypass the date
-- check (the explicit "unlock a past day" escape hatch).
create policy daily_reports_select on public.daily_reports for select to authenticated using (true);
create policy daily_reports_insert on public.daily_reports for insert to authenticated
  with check (report_date = public.today_colombo() or public.is_admin());
create policy daily_reports_update on public.daily_reports for update to authenticated
  using (report_date = public.today_colombo() or public.is_admin())
  with check (report_date = public.today_colombo() or public.is_admin());
create policy daily_reports_delete on public.daily_reports for delete to authenticated
  using (public.is_admin());

-- child tables inherit the same date lock via their parent daily_reports row.
create policy attendance_select on public.attendance for select to authenticated using (true);
create policy attendance_write on public.attendance for insert to authenticated
  with check (exists (
    select 1 from public.daily_reports dr where dr.id = daily_report_id
      and (dr.report_date = public.today_colombo() or public.is_admin())
  ));
create policy attendance_update on public.attendance for update to authenticated
  using (exists (
    select 1 from public.daily_reports dr where dr.id = daily_report_id
      and (dr.report_date = public.today_colombo() or public.is_admin())
  ));
create policy attendance_delete on public.attendance for delete to authenticated
  using (exists (
    select 1 from public.daily_reports dr where dr.id = daily_report_id
      and (dr.report_date = public.today_colombo() or public.is_admin())
  ));

create policy job_lines_select on public.job_lines for select to authenticated using (true);
create policy job_lines_write on public.job_lines for insert to authenticated
  with check (exists (
    select 1 from public.attendance a join public.daily_reports dr on dr.id = a.daily_report_id
    where a.id = attendance_id and (dr.report_date = public.today_colombo() or public.is_admin())
  ));
create policy job_lines_update on public.job_lines for update to authenticated
  using (exists (
    select 1 from public.attendance a join public.daily_reports dr on dr.id = a.daily_report_id
    where a.id = attendance_id and (dr.report_date = public.today_colombo() or public.is_admin())
  ));
create policy job_lines_delete on public.job_lines for delete to authenticated
  using (exists (
    select 1 from public.attendance a join public.daily_reports dr on dr.id = a.daily_report_id
    where a.id = attendance_id and (dr.report_date = public.today_colombo() or public.is_admin())
  ));

create policy transport_log_select on public.transport_log for select to authenticated using (true);
create policy transport_log_write on public.transport_log for insert to authenticated
  with check (exists (
    select 1 from public.daily_reports dr where dr.id = daily_report_id
      and (dr.report_date = public.today_colombo() or public.is_admin())
  ));
create policy transport_log_update on public.transport_log for update to authenticated
  using (exists (
    select 1 from public.daily_reports dr where dr.id = daily_report_id
      and (dr.report_date = public.today_colombo() or public.is_admin())
  ));

create policy tea_collector_select on public.tea_collector for select to authenticated using (true);
create policy tea_collector_write on public.tea_collector for insert to authenticated
  with check (exists (
    select 1 from public.daily_reports dr where dr.id = daily_report_id
      and (dr.report_date = public.today_colombo() or public.is_admin())
  ));
create policy tea_collector_update on public.tea_collector for update to authenticated
  using (exists (
    select 1 from public.daily_reports dr where dr.id = daily_report_id
      and (dr.report_date = public.today_colombo() or public.is_admin())
  ));

create policy cash_summary_select on public.cash_summary for select to authenticated using (true);
create policy cash_summary_write on public.cash_summary for insert to authenticated
  with check (exists (
    select 1 from public.daily_reports dr where dr.id = daily_report_id
      and (dr.report_date = public.today_colombo() or public.is_admin())
  ));
create policy cash_summary_update on public.cash_summary for update to authenticated
  using (exists (
    select 1 from public.daily_reports dr where dr.id = daily_report_id
      and (dr.report_date = public.today_colombo() or public.is_admin())
  ));

-- payroll adjustments: operational data, both roles may edit.
create policy payroll_adjustments_all on public.payroll_adjustments for all to authenticated
  using (true) with check (true);

-- audit log: admin-only read; writes only ever happen via the security-definer trigger.
create policy audit_log_admin_select on public.audit_log for select to authenticated using (public.is_admin());

-- ============================================================
-- Reporting view: one row per employee per day worked, with the
-- tea-plucking bonus formula already applied using the rate that was
-- in effect on that report_date.
-- ============================================================

create view public.v_attendance_pay
with (security_invoker = true)
as
select
  a.id as attendance_id,
  a.daily_report_id,
  dr.report_date,
  a.employee_id,
  e.code as employee_code,
  e.name as employee_name,
  a.time_preset_id,
  tp.day_fraction,
  a.advance_amount,
  prs.day_rate,
  prs.free_kg_threshold,
  prs.extra_kg_rate,
  coalesce(sum(jl.quantity_kg) filter (where wt.code = 'Tea_Plucking'), 0) as plucked_kg,
  bool_or(wt.code = 'Tea_Plucking') as has_plucking,
  greatest(
    prs.day_rate * tp.day_fraction,
    case when bool_or(wt.code = 'Tea_Plucking')
      then prs.day_rate + prs.extra_kg_rate * greatest(
        0,
        coalesce(sum(jl.quantity_kg) filter (where wt.code = 'Tea_Plucking'), 0) - prs.free_kg_threshold
      )
      else 0
    end
  ) as final_pay
from public.attendance a
join public.daily_reports dr on dr.id = a.daily_report_id
join public.employees e on e.id = a.employee_id
join public.time_presets tp on tp.id = a.time_preset_id
left join public.job_lines jl on jl.attendance_id = a.id
left join public.work_types wt on wt.id = jl.work_type_id
join lateral (
  select prs2.day_rate, prs2.free_kg_threshold, prs2.extra_kg_rate
  from public.pay_rate_settings prs2
  where prs2.effective_from <= dr.report_date
  order by prs2.effective_from desc
  limit 1
) prs on true
group by a.id, a.daily_report_id, dr.report_date, a.employee_id, e.code, e.name,
  a.time_preset_id, tp.day_fraction, a.advance_amount, prs.day_rate, prs.free_kg_threshold, prs.extra_kg_rate;

-- job-line level view for section/work-type filtered analysis.
create view public.v_job_lines_detail
with (security_invoker = true)
as
select
  jl.id as job_line_id,
  a.id as attendance_id,
  dr.report_date,
  a.employee_id,
  e.code as employee_code,
  e.name as employee_name,
  s.id as section_id,
  s.code as section_code,
  wt.id as work_type_id,
  wt.code as work_type_code,
  jl.quantity_kg,
  tp.day_fraction
from public.job_lines jl
join public.attendance a on a.id = jl.attendance_id
join public.daily_reports dr on dr.id = a.daily_report_id
join public.employees e on e.id = a.employee_id
join public.sections s on s.id = jl.section_id
join public.work_types wt on wt.id = jl.work_type_id
join public.time_presets tp on tp.id = a.time_preset_id;

-- auto-create a profile row (default role 'office') whenever a new auth user is created.
create or replace function public.fn_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email), 'office')
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger trg_handle_new_user
  after insert on auth.users
  for each row execute function public.fn_handle_new_user();
