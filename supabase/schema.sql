-- Schema for INVERSIONES F Y E client registration/auth flow
-- Run this in the Supabase SQL editor.

create extension if not exists "pgcrypto";

create table if not exists public.clientes (
  id uuid primary key default gen_random_uuid(),
  cedula text not null unique,
  password text not null,
  nombre text,
  email text,
  telefono text,
  direccion text,
  tipo_cliente text,
  perfil_completo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.clientes enable row level security;

create policy "Allow anon insert to clientes"
on public.clientes
for insert
with check (true);

create policy "Allow anon select from clientes"
on public.clientes
for select
using (true);

create policy "Allow anon update clientes"
on public.clientes
for update
using (true)
with check (true);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger clientes_set_updated_at
before update on public.clientes
for each row
execute function public.set_updated_at();
