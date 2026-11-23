-- PeakX app: core tables for a NEW Supabase project (accounts, synced data, coach queue, email
-- settings, Form Check videos). Runs before 20261019_payments_billing.sql, which uses touch_updated_at().
-- Every table has row-level security: a member reaches only their own rows. The server's secret key
-- bypasses RLS, so payments and coach tools write from /api.

-- Keeps updated_at current on every update.
create or replace function public.touch_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- The whole app state for one member (src/state/cloud.ts: loadCloud / saveCloud).
create table if not exists public.user_data (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.user_data enable row level security;
create policy "read own data" on public.user_data for select to authenticated using ((select auth.uid()) = user_id);
create policy "add own data" on public.user_data for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "change own data" on public.user_data for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create trigger user_data_touch before update on public.user_data for each row execute function public.touch_updated_at();

-- Form Check, lab check, unmatched food and coach requests (addQueueItem / loadMyQueue).
-- The app sends { id, item }; user_id fills in from the signed-in member.
create table if not exists public.queue_items (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  item jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.queue_items enable row level security;
create policy "read own queue" on public.queue_items for select to authenticated using ((select auth.uid()) = user_id);
create policy "add own queue" on public.queue_items for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "change own queue" on public.queue_items for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create index if not exists queue_items_user on public.queue_items(user_id);
create trigger queue_items_touch before update on public.queue_items for each row execute function public.touch_updated_at();

-- Email reminder settings (watchEmailPrefs / saveEmailPrefs).
create table if not exists public.email_prefs (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  prefs jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.email_prefs enable row level security;
create policy "read own email prefs" on public.email_prefs for select to authenticated using ((select auth.uid()) = user_id);
create policy "add own email prefs" on public.email_prefs for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "change own email prefs" on public.email_prefs for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create trigger email_prefs_touch before update on public.email_prefs for each row execute function public.touch_updated_at();

-- Account → Delete account (deleteCloudAccount). Removing the auth user cascades to every table above
-- and to billing. Uploaded videos stay in storage: delete them from the dashboard if asked to.
create or replace function public.delete_my_account() returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  delete from auth.users where id = auth.uid();
end;
$$;
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- Form Check videos: private bucket, one folder per member ({user_id}/{id}.mp4), 150 MB like the app's limit.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('form-videos', 'form-videos', false, 157286400, array['video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v'])
on conflict (id) do nothing;
create policy "upload own videos" on storage.objects for insert to authenticated
  with check (bucket_id = 'form-videos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "replace own videos" on storage.objects for update to authenticated
  using (bucket_id = 'form-videos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "read own videos" on storage.objects for select to authenticated
  using (bucket_id = 'form-videos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "delete own videos" on storage.objects for delete to authenticated
  using (bucket_id = 'form-videos' and (storage.foldername(name))[1] = (select auth.uid())::text);
