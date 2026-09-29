# Tea Estate Daily Report & Payroll

A mobile-first web app (installable as a PWA) for the estate office to enter each day's
report once, amend it same-day, analyze production, and run payroll. See
`1. Meta/Data.txt` and the PDF/photos in that folder for the original paper process this
replaces.

## 1. Create your Supabase project (free tier)

1. Go to [supabase.com](https://supabase.com) and sign up (you can use your GitHub account).
2. Click **New project**. Pick any name/region and set a database password (save it
   somewhere safe — you likely won't need it again since the app uses the API keys below).
3. Wait ~2 minutes for the project to finish provisioning.
4. In the left sidebar, go to **SQL Editor** → **New query**. Paste the contents of
   `supabase/migrations/0001_schema.sql`, run it, then do the same for
   `supabase/migrations/0002_seed.sql`. This creates all tables/security rules and loads
   the employees/sections/work types/rates already listed in `1. Meta/Data.txt`.
5. Go to **Project Settings → API**. You'll need three values for the next step:
   - **Project URL**
   - **anon public** key
   - **service_role** key (keep this one secret — server-only, never in the browser)

## 2. Configure the app locally

```bash
cp .env.example .env.local
```

Fill in the three values from step 1.5 above, then:

```bash
npm install
npm run dev
```

Open http://localhost:3000 — it will redirect you to `/login`.

## 3. Create your first admin account

The app has no public sign-up screen (only an admin can invite new users), so bootstrap
the first admin directly in Supabase:

1. Supabase dashboard → **Authentication → Users → Add user** → create yourself with an
   email + password (check "Auto Confirm User").
2. Supabase dashboard → **Table Editor → profiles** → find the row that was auto-created
   for you → set `role` to `admin`.
3. Log in at `/login` with that email/password. You'll now see the **Admin** tab, from
   which you can invite the office person's account (Admin → Users) and manage
   employees, sections, estate works, time presets, and pay rates.

## 4. Deploy to Vercel (free tier)

1. Push this repository to GitHub.
2. Go to [vercel.com](https://vercel.com), sign up with GitHub, click **Add New → Project**,
   and import this repo.
3. In the import screen's **Environment Variables**, add the same three variables from
   your `.env.local`.
4. Click **Deploy**. Once it finishes, open the given URL on a phone — Chrome/Safari will
   offer "Add to Home Screen", which installs it like a native app.

## How the core rules are enforced

- **"Today only" entry lock**: enforced in the database (Postgres Row Level Security),
  not just the UI — see `supabase/migrations/0001_schema.sql`. An office account can only
  insert/update a `daily_reports` row dated today (Asia/Colombo time); once the date
  rolls over, the database itself rejects further edits. Admins have an explicit
  override to fix a past day.
- **Amendments**: every save updates the same day's row and bumps an amendment counter
  visible at the top of the Entry page; every change is also written to `audit_log`
  (Admin → Audit Log).
- **Tea-plucking pay formula**: implemented once, in the `v_attendance_pay` SQL view, so
  the Analysis and Payroll pages can't disagree with each other. See the view definition
  and the "Payroll Formula" section of the project plan for the worked examples it was
  checked against.
- **Rate changes over time**: `pay_rate_settings` is versioned by `effective_from` date;
  changing a rate from the Admin screen never rewrites past payroll.

## Local development notes

- Built on Next.js 16 (App Router, Turbopack). The route-protection file is
  `src/proxy.ts` (Next 16 renamed `middleware.ts` → `proxy.ts`).
- No ORM — the Supabase JS client talks to Postgres directly; all access control is
  enforced by RLS policies in the SQL migration, not in application code.
