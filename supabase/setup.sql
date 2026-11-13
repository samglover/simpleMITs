-- simpleMITs sync: run this once in your Supabase project's SQL Editor.

-- One row per user, holding their whole task list.
create table if not exists public.user_data (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  tasks      jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),

  -- Tasks must be a list, and a modest size (a long MIT list is a few KB).
  constraint tasks_is_array check (jsonb_typeof(tasks) = 'array'),
  constraint tasks_size_limit check (pg_column_size(tasks) < 100000)
);

-- Row-level security: each signed-in user can only see and change their own row.
alter table public.user_data enable row level security;

create policy "Users can read their own data"
  on public.user_data for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own data"
  on public.user_data for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own data"
  on public.user_data for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on public.user_data from anon;
grant select, insert, update on public.user_data to authenticated;

-- Lets a signed-in user delete their own account. Their row in user_data is
-- deleted with it (on delete cascade).
create or replace function public.delete_account()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from auth.users where id = auth.uid();
$$;

revoke execute on function public.delete_account() from public, anon;
grant execute on function public.delete_account() to authenticated;
