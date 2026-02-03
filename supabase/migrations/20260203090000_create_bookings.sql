create type if not exists public.booking_status as enum (
  'pending',
  'confirmed',
  'cancelled',
  'completed'
);

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  created_at timestamptz not null default now()
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  booking_date date not null,
  booking_time time not null,
  name text not null,
  phone text not null,
  email text,
  service text,
  message text,
  status public.booking_status not null default 'pending',
  payment_status text not null default 'unpaid',
  consent_at timestamptz not null default now(),
  source text not null default 'web'
);

alter table public.bookings enable row level security;
alter table public.admin_users enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.admin_users
    where user_id = auth.uid()
  );
$$;

alter table public.bookings
  add constraint bookings_weekday_check
  check (extract(isodow from booking_date) between 1 and 5);

alter table public.bookings
  add constraint bookings_time_check
  check (
    booking_time >= time '10:00'
    and booking_time <= time '18:00'
    and extract(minute from booking_time) = 0
  );

create unique index if not exists bookings_unique_slot
  on public.bookings (booking_date, booking_time)
  where status in ('pending', 'confirmed');

create policy "public can insert booking requests"
  on public.bookings
  for insert
  with check (
    status = 'pending'
    and payment_status = 'unpaid'
    and source = 'web'
    and booking_date >= current_date
  );

create policy "admins can view bookings"
  on public.bookings
  for select
  using (public.is_admin());

create policy "admins can update bookings"
  on public.bookings
  for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "admins can delete bookings"
  on public.bookings
  for delete
  using (public.is_admin());

create policy "admins can view admin list"
  on public.admin_users
  for select
  using (public.is_admin());
