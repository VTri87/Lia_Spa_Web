-- Supabase schema for Lia Spa admin

create table if not exists services (
  id bigserial primary key,
  name text not null,
  price_cents integer not null,
  tax_rate numeric(5,2) not null default 19.00,
  active boolean not null default true,
  sort_order integer not null default 0
);

create table if not exists receipts (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  service_id bigint references services(id),
  service_name text not null,
  price_cents integer not null,
  tax_rate numeric(5,2) not null,
  tax_cents integer not null,
  total_cents integer not null,
  payment_method text not null,
  customer_name text,
  note text
);

create index if not exists receipts_created_at_idx on receipts(created_at);

alter table services enable row level security;
create policy "Read services" on services
  for select to authenticated
  using (true);

alter table receipts enable row level security;
create policy "Read receipts" on receipts
  for select to authenticated
  using (true);
create policy "Insert receipts" on receipts
  for insert to authenticated
  with check (true);

insert into services (name, price_cents, tax_rate, sort_order) values
  ('Manikuere inkl. Shellac', 3000, 19.00, 1),
  ('Pedikuere inkl. Massage', 3100, 19.00, 2),
  ('Pedikuere inkl. Shellac', 4300, 19.00, 3),
  ('Ablosen', 1500, 19.00, 4),
  ('UV-Gel Natur (Neu)', 3200, 19.00, 5),
  ('UV-Gel Natur (Auffuellen)', 2900, 19.00, 6),
  ('UV-Gel French (Neu)', 3800, 19.00, 7),
  ('UV-Gel French (Auffuellen)', 3500, 19.00, 8),
  ('UV-Lack / Farb-Gel (Neu)', 3900, 19.00, 9),
  ('UV-Lack / Farb-Gel (Auffuellen)', 3600, 19.00, 10),
  ('Babyboomer (Neu)', 4000, 19.00, 11),
  ('Babyboomer (Auffuellen)', 3700, 19.00, 12),
  ('Extra Lang (Zuschlag)', 200, 19.00, 13),
  ('Design pro Nagel', 200, 19.00, 14),
  ('Design Set', 1000, 19.00, 15),
  ('Strass / Steindesign', 50, 19.00, 16),
  ('Reparatur pro Nagel', 500, 19.00, 17)
on conflict do nothing;
