-- MaDA : à coller une fois dans Supabase → SQL Editor → Run.

-- Marques, créations et idées de chaque compte (synchronisées entre appareils).
create table if not exists public.mada_docs (
  user_id uuid not null references auth.users (id) on delete cascade,
  key text not null,
  kind text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);
alter table public.mada_docs enable row level security;
drop policy if exists "mada_docs_own" on public.mada_docs;
create policy "mada_docs_own" on public.mada_docs for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Connexions Instagram / TikTok. Jetons chiffrés, lus uniquement par le serveur
-- (aucune règle d'accès : l'application ne peut pas lire cette table).
create table if not exists public.mada_social (
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null check (provider in ('instagram', 'tiktok')),
  account_id text,
  username text,
  avatar text,
  token text not null,
  refresh text,
  expires_at timestamptz,
  refresh_expires_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, provider)
);
alter table public.mada_social enable row level security;

-- Fichiers envoyés pour publication (supprimés après publication).
insert into storage.buckets (id, name, public, file_size_limit)
values ('publish', 'publish', false, 262144000)
on conflict (id) do nothing;
drop policy if exists "publish_insert_own" on storage.objects;
create policy "publish_insert_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'publish' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "publish_delete_own" on storage.objects;
create policy "publish_delete_own" on storage.objects for delete to authenticated
  using (bucket_id = 'publish' and (storage.foldername(name))[1] = auth.uid()::text);
