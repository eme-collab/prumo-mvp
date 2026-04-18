create table if not exists public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  notification_type text not null,
  item_type text null,
  item_id uuid null,
  delivery_scope text not null,
  delivery_key text not null unique,
  sent_at timestamptz not null default now(),
  opened_at timestamptz null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists notification_deliveries_user_sent_at_idx
  on public.notification_deliveries(user_id, sent_at desc);

create index if not exists notification_deliveries_item_idx
  on public.notification_deliveries(item_id, sent_at desc);

alter table public.notification_deliveries enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'notification_deliveries'
      and policyname = 'notification_deliveries_select_own'
  ) then
    create policy "notification_deliveries_select_own"
      on public.notification_deliveries
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
      and tablename = 'notification_deliveries'
      and policyname = 'notification_deliveries_update_own'
  ) then
    create policy "notification_deliveries_update_own"
      on public.notification_deliveries
      for update
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end
$$;
