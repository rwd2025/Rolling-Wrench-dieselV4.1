
-- Rolling Wrench AI Command Center V6.6 Supabase Setup
-- Run this in Supabase SQL Editor.

create extension if not exists "pgcrypto";

create table if not exists public.shops (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Rolling Wrench Diesel LLC',
  phone text,
  email text,
  website text,
  address text,
  settings jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid,
  shop_id uuid references public.shops(id) on delete cascade,
  name text,
  email text,
  role text default 'Owner/Admin',
  created_at timestamptz default now()
);

create table if not exists public.rwd_app_data (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid references public.shops(id) on delete cascade,
  user_id uuid,
  app_kind text,
  local_id text,
  payload jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.customer_links (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid references public.shops(id) on delete cascade,
  link_type text,
  local_id text,
  customer text,
  status text default 'Ready',
  payload jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  expires_at timestamptz
);

create table if not exists public.file_records (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid references public.shops(id) on delete cascade,
  local_id text,
  file_name text,
  file_path text,
  public_url text,
  purpose text,
  payload jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create index if not exists idx_rwd_app_data_kind on public.rwd_app_data(app_kind);
create index if not exists idx_rwd_app_data_local on public.rwd_app_data(local_id);
create index if not exists idx_customer_links_local on public.customer_links(local_id);
create index if not exists idx_file_records_local on public.file_records(local_id);

-- For early testing only:
-- You can disable RLS temporarily on these tables while testing.
-- In production, enable RLS and add policies tied to auth.uid() and shop membership.
alter table public.shops disable row level security;
alter table public.profiles disable row level security;
alter table public.rwd_app_data disable row level security;
alter table public.customer_links disable row level security;
alter table public.file_records disable row level security;

-- Storage:
-- Create a public or authenticated bucket named: rwd-files
-- Supabase Dashboard -> Storage -> New bucket -> rwd-files
