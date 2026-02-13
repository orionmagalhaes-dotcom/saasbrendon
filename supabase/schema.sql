-- Execute no SQL Editor do Supabase (projeto fquiicsdvjqzrbeiuaxo)

create table if not exists public.restobar_state (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.restobar_state enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'restobar_state' and policyname = 'allow_anon_all_restobar_state'
  ) then
    create policy allow_anon_all_restobar_state
      on public.restobar_state
      for all
      to anon
      using (true)
      with check (true);
  end if;
end $$;
