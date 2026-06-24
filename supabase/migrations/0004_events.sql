-- AutoHired — schedule events (interviews, meetings, calls, deadlines) (Feature B)
-- Run via Supabase SQL editor or `supabase db push`.

do $$ begin
  create type event_type as enum ('interview', 'meeting', 'call', 'deadline');
exception when duplicate_object then null; end $$;

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- keep the event even if its application is later deleted
  application_id uuid references public.applications (id) on delete set null,
  type event_type not null default 'interview',
  title text not null,
  starts_at timestamptz not null,
  location text,
  notes text,
  done boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists events_user_start_idx on public.events (user_id, starts_at);

alter table public.events enable row level security;

drop policy if exists "Users manage own events" on public.events;
create policy "Users manage own events"
  on public.events for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
