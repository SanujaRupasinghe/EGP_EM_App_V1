-- Section area (acres), so Analysis can show tea kg per acre and let the
-- office compare yield density fairly across differently-sized sections
-- instead of just raw kg (a big section naturally produces more kg — the
-- useful comparison is kg/acre).

alter table public.sections add column if not exists area_acres numeric(10, 2);
