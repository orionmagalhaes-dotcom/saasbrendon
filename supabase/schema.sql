-- Execute no SQL Editor do Supabase (projeto fquiicsdvjqzrbeiuaxo)
-- Nota: este app e cliente-side puro. Em producao, idealmente mova escrita para
-- uma Edge Function com validacao de identidade/autorizacao.

create table if not exists public.restobar_state (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.restobar_state enable row level security;

do $$
begin
  -- Remove policy antiga extremamente permissiva, se existir.
  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'restobar_state' and policyname = 'allow_anon_all_restobar_state'
  ) then
    drop policy allow_anon_all_restobar_state on public.restobar_state;
  end if;

  -- Garante que so exista a linha singleton "main".
  if not exists (
    select 1 from pg_constraint
    where conname = 'restobar_state_singleton_main'
      and conrelid = 'public.restobar_state'::regclass
  ) then
    alter table public.restobar_state
      add constraint restobar_state_singleton_main check (id = 'main');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'restobar_state' and policyname = 'allow_anon_select_main_restobar_state'
  ) then
    create policy allow_anon_select_main_restobar_state
      on public.restobar_state
      for select
      to anon
      using (id = 'main');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'restobar_state' and policyname = 'allow_anon_insert_main_restobar_state'
  ) then
    create policy allow_anon_insert_main_restobar_state
      on public.restobar_state
      for insert
      to anon
      with check (id = 'main');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'restobar_state' and policyname = 'allow_anon_update_main_restobar_state'
  ) then
    create policy allow_anon_update_main_restobar_state
      on public.restobar_state
      for update
      to anon
      using (id = 'main')
      with check (id = 'main');
  end if;
end $$;
