-- AutoHired — full schema provision (0001 + 0002 + 0003 combined, idempotent)
-- Use ONLY when re-creating a fresh Supabase project after deletion.
-- Paste whole file into Supabase SQL editor and run once.

-- ============ Profiles ============
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text,
  headline text,
  avatar_url text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "Users manage own profile" on public.profiles;
create policy "Users manage own profile"
  on public.profiles for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', ''));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- profile detail columns (0002)
alter table public.profiles
  add column if not exists summary text,
  add column if not exists skills text,
  add column if not exists experience text,
  add column if not exists education text,
  add column if not exists location text,
  add column if not exists links text;

-- ============ Applications ============
do $$ begin
  create type application_status as enum
    ('draft', 'applying', 'applied', 'interviewing', 'offer', 'rejected');
exception when duplicate_object then null; end $$;

create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  url text not null,
  title text not null,
  company text not null,
  location text,
  description text not null default '',
  requirements jsonb not null default '[]'::jsonb,
  deadline date,
  status application_status not null default 'draft',
  match_score smallint check (match_score between 0 and 100),
  created_at timestamptz not null default now()
);

create index if not exists applications_user_idx on public.applications (user_id, created_at desc);
alter table public.applications enable row level security;

drop policy if exists "Users manage own applications" on public.applications;
create policy "Users manage own applications"
  on public.applications for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============ Documents ============
do $$ begin
  create type document_type as enum ('resume', 'cv', 'cover_letter', 'portfolio');
exception when duplicate_object then null; end $$;
do $$ begin
  create type document_status as enum ('pending', 'analyzed');
exception when duplicate_object then null; end $$;

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  type document_type not null default 'resume',
  storage_path text not null,
  parsed_text text,
  status document_status not null default 'pending',
  added_at timestamptz not null default now()
);

create index if not exists documents_user_idx on public.documents (user_id, added_at desc);
alter table public.documents enable row level security;

drop policy if exists "Users manage own documents" on public.documents;
create policy "Users manage own documents"
  on public.documents for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============ Tasks ============
do $$ begin
  create type task_source as enum ('ai', 'manual');
exception when duplicate_object then null; end $$;

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  label text not null,
  due_date date,
  done boolean not null default false,
  source task_source not null default 'manual',
  created_at timestamptz not null default now()
);

create index if not exists tasks_application_idx on public.tasks (application_id);
create index if not exists tasks_user_due_idx on public.tasks (user_id, due_date);
alter table public.tasks enable row level security;

drop policy if exists "Users manage own tasks" on public.tasks;
create policy "Users manage own tasks"
  on public.tasks for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============ Analyses ============
create table if not exists public.analyses (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  document_id uuid not null references public.documents (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  match_score smallint not null check (match_score between 0 and 100),
  verdict text not null,
  summary text not null,
  suggestions jsonb not null default '[]'::jsonb,
  gaps jsonb not null default '[]'::jsonb,
  strengths jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (application_id, document_id)
);

create index if not exists analyses_user_idx on public.analyses (user_id, created_at desc);
alter table public.analyses enable row level security;

drop policy if exists "Users manage own analyses" on public.analyses;
create policy "Users manage own analyses"
  on public.analyses for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============ Storage: documents (private) ============
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

drop policy if exists "Users read own files" on storage.objects;
create policy "Users read own files"
  on storage.objects for select
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users upload own files" on storage.objects;
create policy "Users upload own files"
  on storage.objects for insert
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users delete own files" on storage.objects;
create policy "Users delete own files"
  on storage.objects for delete
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);

-- ============ Storage: avatars (public) (0003) ============
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "Avatar public read" on storage.objects;
create policy "Avatar public read"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "Users upload own avatar" on storage.objects;
create policy "Users upload own avatar"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users update own avatar" on storage.objects;
create policy "Users update own avatar"
  on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users delete own avatar" on storage.objects;
create policy "Users delete own avatar"
  on storage.objects for delete
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
