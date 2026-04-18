create table if not exists public.app_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null references auth.users(id) on delete set null,
  session_id text not null,
  event_name text not null,
  properties jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists app_events_user_id_occurred_at_idx
  on public.app_events(user_id, occurred_at desc);

create index if not exists app_events_event_name_occurred_at_idx
  on public.app_events(event_name, occurred_at desc);

alter table public.app_events enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'app_events'
      and policyname = 'app_events_select_own'
  ) then
    create policy "app_events_select_own"
      on public.app_events
      for select
      using (auth.uid() = user_id);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'app_events'
      and policyname = 'app_events_insert_own'
  ) then
    create policy "app_events_insert_own"
      on public.app_events
      for insert
      with check (auth.uid() = user_id);
  end if;
end
$$;
