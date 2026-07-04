# Cloud saves + login + admin — setup

The game works offline with no setup. To enable accounts, cloud saves, and the
`/admin` dashboard, do this once (~5 minutes):

## 1. Create a Supabase project

Go to [supabase.com](https://supabase.com) → **New project** (free tier is fine).
Wait for it to finish provisioning.

## 2. Create the database table

Open **SQL Editor** in Supabase, paste this, and hit **Run**:

```sql
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  username text,
  cash bigint default 0,
  xp bigint default 0,
  level int default 1,
  lab2_unlocked boolean default false,
  trees_chopped int default 0,
  save jsonb,
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;

-- Players can read & write ONLY their own row.
create policy "own profile read"   on public.profiles for select using (auth.uid() = id);
create policy "own profile insert" on public.profiles for insert with check (auth.uid() = id);
create policy "own profile update" on public.profiles for update using (auth.uid() = id);
```

> The admin dashboard reads all rows via the service-role key, which bypasses
> RLS — so no extra admin policy is needed.

## 3. (Optional) Turn off email confirmation for instant signups

Supabase → **Authentication → Providers → Email** → toggle **Confirm email** off
if you want players to log in immediately after signing up. Leave it on to
require inbox confirmation.

## 4. Add your keys

Copy `.env.example` to `.env.local` and fill in:

- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  — from **Project Settings → API**.
- `SUPABASE_SERVICE_ROLE_KEY` — the **service_role** secret on that same page.
  This is server-only; never commit it or expose it to the browser.
- `ADMIN_EMAIL` / `NEXT_PUBLIC_ADMIN_EMAIL` — the email you'll sign up with.

Restart the dev server after editing `.env.local`.

## 5. Use it

- A **Log in** button appears in the top bar. Sign up, and your farm now syncs
  to the cloud (newest device wins on conflict).
- Sign up once with your `ADMIN_EMAIL`, then open **/admin** (or the "Admin
  dashboard" link in the account menu) to see every player's cash, level, XP,
  trees chopped, and last-active time.

Deploying (e.g. Vercel): add the same env vars in the host's dashboard.
