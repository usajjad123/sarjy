begin;

-- One saved document per user; the version detects competing edits.
create table if not exists public.sarjy_workspaces (
  user_id uuid primary key references auth.users(id) on delete cascade,
  version integer not null check (version >= 0),
  data jsonb not null check (
    jsonb_typeof(data) = 'object'
    and (data ->> 'version')::integer = version
  ),
  updated_at timestamptz not null default now()
);

-- Shared per-minute limits for food actions and voice-session creation.
create table if not exists public.sarjy_rate_limits (
  user_id uuid not null references auth.users(id) on delete cascade,
  scope text not null check (scope in ('actions', 'voice')),
  bucket bigint not null,
  count integer not null,
  primary key (user_id, scope)
);

-- One-time bridge from existing local records to a Supabase identity.
create table if not exists public.sarjy_legacy_imports (
  legacy_id uuid primary key,
  user_id uuid not null unique references auth.users(id) on delete cascade,
  imported_at timestamptz not null default now()
);

alter table public.sarjy_workspaces enable row level security;
alter table public.sarjy_rate_limits enable row level security;
alter table public.sarjy_legacy_imports enable row level security;

revoke all on
  public.sarjy_workspaces,
  public.sarjy_rate_limits,
  public.sarjy_legacy_imports
from anon, authenticated;

grant select on public.sarjy_workspaces to authenticated;

drop policy if exists sarjy_read_own_workspace on public.sarjy_workspaces;
create policy sarjy_read_own_workspace on public.sarjy_workspaces
  for select to authenticated
  using (user_id = (select auth.uid()));

-- Writes go through functions which derive their owner from the verified JWT.
-- There are no direct client write grants or public-user policies.
create or replace function public.initialize_sarjy_workspace(
  p_initial jsonb,
  p_legacy_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_current jsonb;
  v_owner uuid;
begin
  if v_user is null then
    raise exception 'SARJY_AUTH_REQUIRED';
  end if;

  select data into v_current
  from public.sarjy_workspaces
  where user_id = v_user;

  if v_current is not null then
    return v_current;
  end if;

  if jsonb_typeof(p_initial) is distinct from 'object'
    or (p_initial ->> 'version')::integer < 0
    or octet_length(p_initial::text) > 8000000
  then
    raise exception 'SARJY_INVALID_STATE';
  end if;

  if p_legacy_id is not null then
    insert into public.sarjy_legacy_imports(legacy_id, user_id)
    values(p_legacy_id, v_user)
    on conflict(legacy_id) do nothing;

    select user_id into v_owner
    from public.sarjy_legacy_imports
    where legacy_id = p_legacy_id;

    if v_owner is distinct from v_user then
      raise exception 'SARJY_LEGACY_ALREADY_IMPORTED';
    end if;
  end if;

  insert into public.sarjy_workspaces(user_id, version, data)
  values(v_user, (p_initial ->> 'version')::integer, p_initial)
  on conflict(user_id) do nothing;

  select data into v_current
  from public.sarjy_workspaces
  where user_id = v_user;

  return v_current;
end;
$$;

-- Save atomically: retries do not duplicate changes; stale edits are rejected.
create or replace function public.commit_sarjy_workspace(
  p_expected_version integer,
  p_next jsonb,
  p_call_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_current public.sarjy_workspaces%rowtype;
  v_next_version integer;
begin
  if v_user is null then
    raise exception 'SARJY_AUTH_REQUIRED';
  end if;

  if p_call_id is null or length(p_call_id) not between 1 and 200 then
    raise exception 'SARJY_INVALID_STATE';
  end if;

  select * into v_current
  from public.sarjy_workspaces
  where user_id = v_user
  for update;

  if not found then
    raise exception 'SARJY_STATE_MISSING';
  end if;

  if coalesce(v_current.data -> 'appliedCalls', '[]'::jsonb) ? p_call_id then
    return v_current.data;
  end if;

  if v_current.version <> p_expected_version then
    raise exception 'SARJY_CONFLICT';
  end if;

  v_next_version := (p_next ->> 'version')::integer;
  if jsonb_typeof(p_next) is distinct from 'object'
    or v_next_version is null
    or v_next_version not in (p_expected_version, p_expected_version + 1)
    or octet_length(p_next::text) > 8000000
    or not(coalesce(p_next -> 'appliedCalls', '[]'::jsonb) ? p_call_id)
  then
    raise exception 'SARJY_INVALID_STATE';
  end if;

  update public.sarjy_workspaces
  set version = v_next_version, data = p_next, updated_at = now()
  where user_id = v_user;

  return p_next;
end;
$$;

create or replace function public.consume_sarjy_rate_limit(
  p_scope text default 'actions'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_bucket bigint := floor(extract(epoch from now()) / 60);
  v_count integer;
  v_limit integer;
begin
  if v_user is null then
    raise exception 'SARJY_AUTH_REQUIRED';
  end if;

  if p_scope not in ('actions', 'voice') then
    raise exception 'SARJY_INVALID_STATE';
  end if;

  v_limit := case when p_scope = 'voice' then 12 else 120 end;
  insert into public.sarjy_rate_limits(user_id, scope, bucket, count)
  values(v_user, p_scope, v_bucket, 1)
  on conflict(user_id, scope) do update
  set count = case
    when sarjy_rate_limits.bucket = excluded.bucket then sarjy_rate_limits.count + 1
    else 1
  end,
  bucket = excluded.bucket
  returning count into v_count;

  if v_count > v_limit then
    raise exception 'SARJY_RATE_LIMIT';
  end if;
end;
$$;

revoke all on function
  public.initialize_sarjy_workspace(jsonb, uuid),
  public.commit_sarjy_workspace(integer, jsonb, text),
  public.consume_sarjy_rate_limit(text)
from public, anon;

grant execute on function
  public.initialize_sarjy_workspace(jsonb, uuid),
  public.commit_sarjy_workspace(integer, jsonb, text),
  public.consume_sarjy_rate_limit(text)
to authenticated;

commit;
