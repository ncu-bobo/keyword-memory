create extension if not exists pgcrypto;

create table if not exists public.knowledge_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  keywords text[] not null default '{}',
  tag text,
  pinned boolean not null default false,
  source_text text,
  source_url text,
  source_excerpt text,
  review_at timestamptz not null default now(),
  review_level integer not null default 0,
  last_reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.review_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  knowledge_item_id uuid not null references public.knowledge_items(id) on delete cascade,
  result text not null check (result in ('forgot', 'vague', 'remembered')),
  reviewed_at timestamptz not null default now()
);

create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique(user_id, name)
);

create index if not exists knowledge_items_user_review_idx
  on public.knowledge_items(user_id, review_at, pinned desc);

create index if not exists knowledge_items_user_tag_idx
  on public.knowledge_items(user_id, tag);

alter table public.knowledge_items enable row level security;
alter table public.review_logs enable row level security;
alter table public.tags enable row level security;

create policy "Users can manage own knowledge items"
  on public.knowledge_items
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can manage own review logs"
  on public.review_logs
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can manage own tags"
  on public.tags
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists knowledge_items_set_updated_at on public.knowledge_items;
create trigger knowledge_items_set_updated_at
  before update on public.knowledge_items
  for each row execute function public.set_updated_at();
