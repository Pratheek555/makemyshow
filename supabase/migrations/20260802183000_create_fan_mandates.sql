create table if not exists public.fan_mandates (
  id bigint generated always as identity primary key,
  fan_user_id uuid not null references auth.users(id) on delete cascade,
  city_drop_id uuid references public.city_drops(id) on delete set null,
  drop_slug text,
  artist_name text not null,
  city text not null,
  quantity integer not null check (quantity between 1 and 8),
  price_ceiling_minor integer not null check (price_ceiling_minor > 0),
  deposit_cap_minor integer not null check (deposit_cap_minor > 0),
  currency text not null default 'INR',
  prava_session_id text not null,
  prava_order_id text,
  status text not null default 'authorized'
    check (status in ('authorized', 'artist_approved', 'charged', 'cancelled', 'failed')),
  prava_result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (prava_session_id)
);

create index if not exists fan_mandates_fan_user_id_idx on public.fan_mandates (fan_user_id);
create index if not exists fan_mandates_city_drop_id_idx on public.fan_mandates (city_drop_id);
create index if not exists fan_mandates_status_idx on public.fan_mandates (status);

alter table public.fan_mandates enable row level security;

create policy "fans can read their own mandates"
  on public.fan_mandates
  for select
  to authenticated
  using ((select auth.uid()) = fan_user_id);

create policy "fans can cancel their own authorized mandates"
  on public.fan_mandates
  for update
  to authenticated
  using ((select auth.uid()) = fan_user_id and status = 'authorized')
  with check ((select auth.uid()) = fan_user_id and status in ('authorized', 'cancelled'));
