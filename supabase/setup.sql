-- simpleMITs sync: run this in your Supabase project's SQL Editor.
--
-- It's safe to run again, for example after updating simpleMITs. Existing
-- data is kept.

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

drop policy if exists "Users can read their own data" on public.user_data;
create policy "Users can read their own data"
  on public.user_data for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their own data" on public.user_data;
create policy "Users can create their own data"
  on public.user_data for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own data" on public.user_data;
create policy "Users can update their own data"
  on public.user_data for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on public.user_data from anon;
grant select, insert, update on public.user_data to authenticated;

-- Saves a user's task list, unless the stored list is newer. The check and the
-- save happen in one statement, so an older upload that arrives late can't
-- overwrite a newer one from another device.
--
-- Returns the list that ends up stored, and whether it's the one just sent.
-- Runs as the calling user, so the row-level security policies above apply.
create or replace function public.save_tasks(new_tasks jsonb, new_updated_at timestamptz)
returns table (saved_tasks jsonb, saved_updated_at timestamptz, accepted boolean)
language plpgsql
security invoker
set search_path = ''
as $$
begin
  return query
    insert into public.user_data as d (user_id, tasks, updated_at)
    values (auth.uid(), new_tasks, new_updated_at)
    on conflict (user_id) do update
      set tasks = excluded.tasks, updated_at = excluded.updated_at
      where d.updated_at < excluded.updated_at
    returning d.tasks, d.updated_at, true;

  -- The stored list was newer (or the same age), so nothing was saved.
  if not found then
    return query
      select d.tasks, d.updated_at, false
      from public.user_data as d
      where d.user_id = auth.uid();
  end if;
end;
$$;

revoke execute on function public.save_tasks(jsonb, timestamptz) from public, anon;
grant execute on function public.save_tasks(jsonb, timestamptz) to authenticated;

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
