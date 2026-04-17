create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.user_app_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  has_completed_first_capture boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_app_state enable row level security;

drop trigger if exists set_user_app_state_updated_at on public.user_app_state;

create trigger set_user_app_state_updated_at
before update on public.user_app_state
for each row
execute function public.set_updated_at();

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'user_app_state'
      and policyname = 'user_app_state_select_own'
  ) then
    create policy "user_app_state_select_own"
      on public.user_app_state
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
      and tablename = 'user_app_state'
      and policyname = 'user_app_state_insert_own'
  ) then
    create policy "user_app_state_insert_own"
      on public.user_app_state
      for insert
      with check (auth.uid() = user_id);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'user_app_state'
      and policyname = 'user_app_state_update_own'
  ) then
    create policy "user_app_state_update_own"
      on public.user_app_state
      for update
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end
$$;
