-- Tea fertilizing/manure is now measured in worker-days (wd), like weeding:
-- the amount is the day_fraction of whoever did it, not a kg quantity.

update public.work_types set requires_quantity = false where code = 'Tea_Fertilizing/Manure';

update public.job_lines jl set quantity_kg = null
from public.work_types wt
where wt.id = jl.work_type_id and not wt.requires_quantity and jl.quantity_kg is not null;

-- Keep it that way for future inserts/imports: work types that don't track a
-- quantity never store kg.
create or replace function public.clear_quantity_if_not_required()
returns trigger
language plpgsql
as $$
begin
  if exists (select 1 from public.work_types wt where wt.id = new.work_type_id and not wt.requires_quantity) then
    new.quantity_kg := null;
  end if;
  return new;
end;
$$;

drop trigger if exists job_lines_clear_quantity on public.job_lines;
create trigger job_lines_clear_quantity
before insert or update on public.job_lines
for each row execute function public.clear_quantity_if_not_required();
