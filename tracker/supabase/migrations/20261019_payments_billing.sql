-- Applied to project peakx on 2026-10-19. Billing is written only by the server (service role).
create table if not exists public.billing (user_id uuid primary key references auth.users(id) on delete cascade, data jsonb not null, updated_at timestamptz not null default now());
alter table public.billing enable row level security;
create policy "read own billing" on public.billing for select to authenticated using ((select auth.uid()) = user_id);
create trigger billing_touch before update on public.billing for each row execute function public.touch_updated_at();
create table if not exists public.pay_subscriptions (id text primary key, user_id uuid references auth.users(id) on delete set null, kind text not null, created_at timestamptz not null default now());
create table if not exists public.pay_payments (id text primary key, user_id uuid references auth.users(id) on delete set null, kind text, subscription_id text, amount numeric, at timestamptz not null default now());
create table if not exists public.pay_events (id text primary key, at timestamptz not null default now());
create table if not exists public.app_meta (key text primary key, value jsonb not null);
alter table public.pay_subscriptions enable row level security;
alter table public.pay_payments enable row level security;
alter table public.pay_events enable row level security;
alter table public.app_meta enable row level security;
create index if not exists pay_payments_user on public.pay_payments(user_id);
create index if not exists pay_subscriptions_user on public.pay_subscriptions(user_id);
create or replace function public.bump_founding(delta int, base int) returns int language sql set search_path = '' as $$
  insert into public.app_meta(key, value) values ('founding', jsonb_build_object('taken', greatest(0, base + delta)))
  on conflict (key) do update set value = jsonb_build_object('taken', greatest(0, coalesce((public.app_meta.value->>'taken')::int, base) + delta))
  returning (value->>'taken')::int;
$$;
revoke execute on function public.bump_founding(int, int) from public, anon, authenticated;
alter publication supabase_realtime add table public.billing;

-- 19 Oct, later: early bird counter by key (app_meta 'early_bird' for live keys, 'early_bird_test' for test keys).
create or replace function public.bump_counter(k text, delta int, base int) returns int language sql set search_path = '' as $$
  insert into public.app_meta(key, value) values (k, jsonb_build_object('taken', greatest(0, base + delta)))
  on conflict (key) do update set value = jsonb_build_object('taken', greatest(0, coalesce((public.app_meta.value->>'taken')::int, base) + delta))
  returning (value->>'taken')::int;
$$;
revoke execute on function public.bump_counter(text, int, int) from public, anon, authenticated;
-- bump_founding and the app_meta 'founding' row are no longer used.
