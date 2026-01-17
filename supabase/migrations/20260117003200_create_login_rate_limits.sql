create table if not exists public.login_rate_limits (
  ip text primary key,
  attempts integer not null default 0,
  window_start timestamptz not null default now(),
  lock_until timestamptz,
  updated_at timestamptz not null default now(),
  last_email text
);

alter table public.login_rate_limits disable row level security;
