-- Reference data seed, taken from "1. Meta/Data.txt".
-- The office/admin can add, edit, and deactivate any of these later from the Admin screens
-- without touching this file again — this just gets the app usable on day one.

insert into public.employees (code, name, gender) values
  ('m1', 'Kokila', 'M'),
  ('m3', 'P. Nimal', 'M'),
  ('m6', 'Sarath', 'M'),
  ('f1', 'Seetha', 'F'),
  ('f3', 'Soma', 'F'),
  ('f4', 'Swarna', 'F'),
  ('f6', 'Nilanthi', 'F'),
  ('f8', 'Lakmali', 'F'),
  ('f13', 'Wimala', 'F'),
  ('f20', 'Surangi', 'F'),
  ('f26', 'Dilshani', 'F'),
  ('f27', 'Irosha', 'F'),
  ('f28', 'Sandya', 'F'),
  ('f29', 'Chathurani', 'F'),
  ('f31', 'Dhaneesha', 'F')
on conflict (code) do nothing;

-- Note: source list had "2C3" twice; deduplicated to the 7 distinct codes below.
insert into public.sections (code) values
  ('1D'), ('1C1'), ('1B3'), ('1B2'), ('2C3'), ('3A1'), ('2A1')
on conflict (code) do nothing;

insert into public.work_types (code, requires_quantity) values
  ('Tea_Plucking', true),
  ('Tea_Weeding', false),
  ('Fertilizing', false)
on conflict (code) do nothing;

insert into public.time_presets (label, start_time, end_time, day_fraction) values
  ('Full day (7:30–1:30)', '07:30', '13:30', 1.0),
  ('Long day (7:30–4:30)', '07:30', '16:30', 1.5),
  ('Half day, late start (10:30–1:30)', '10:30', '13:30', 0.5),
  ('Half day, early finish (7:30–10:30)', '07:30', '10:30', 0.5);

insert into public.pay_rate_settings (effective_from, day_rate, free_kg_threshold, extra_kg_rate) values
  ('2020-01-01', 800.00, 18.00, 50.00)
on conflict (effective_from) do nothing;
