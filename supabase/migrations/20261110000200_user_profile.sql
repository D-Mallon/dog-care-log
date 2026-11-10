-- ============================================================================
-- User profile and notification preferences
-- ----------------------------------------------------------------------------
-- Display names are written through a SECURITY DEFINER RPC because clients have
-- no direct write access to auth.users or HouseholdMember. Preferences are
-- owner-only rows; deleting the auth user cascades the preference away.
-- ============================================================================

create table if not exists "UserPreference" (
  "userId" uuid primary key references auth.users(id) on delete cascade,
  "emailReminders" boolean not null default false,
  "weeklySummary" boolean not null default false,
  "productUpdates" boolean not null default false,
  timezone text not null default 'Europe/Dublin',
  "updatedAt" timestamptz not null default now(),
  constraint "UserPreference_timezone_length"
    check (char_length(btrim(timezone)) between 1 and 80)
);

alter table "UserPreference" enable row level security;

drop policy if exists "user_preference_select_own" on "UserPreference";
create policy "user_preference_select_own"
  on "UserPreference"
  for select
  to authenticated
  using ("userId" = auth.uid());

drop policy if exists "user_preference_insert_own" on "UserPreference";
create policy "user_preference_insert_own"
  on "UserPreference"
  for insert
  to authenticated
  with check ("userId" = auth.uid());

drop policy if exists "user_preference_update_own" on "UserPreference";
create policy "user_preference_update_own"
  on "UserPreference"
  for update
  to authenticated
  using ("userId" = auth.uid())
  with check ("userId" = auth.uid());

revoke all on table "UserPreference" from public, anon, authenticated;
grant select, insert, update on table "UserPreference" to authenticated;
grant all on table "UserPreference" to service_role;

comment on table "UserPreference" is
  'Per-user notification and product preferences. Owner-only RLS; cascades with auth.users.';

-- ============================================================================
-- update_display_name(p_name text)
-- ----------------------------------------------------------------------------
-- Updates the auth metadata display_name and every household membership row for
-- the caller so "Logged by ..." changes immediately without exposing
-- HouseholdMember writes to clients.
-- ============================================================================
create or replace function public.update_display_name(p_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_name text := btrim(coalesce(p_name, ''));
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  if char_length(v_name) < 1 or char_length(v_name) > 80 then
    raise exception 'Display name must be between 1 and 80 characters'
      using errcode = '22023';
  end if;

  update auth.users
  set raw_user_meta_data = jsonb_set(
        coalesce(raw_user_meta_data, '{}'::jsonb),
        '{display_name}',
        to_jsonb(v_name),
        true
      )
  where id = v_uid;

  if not found then
    raise exception 'User not found' using errcode = 'P0002';
  end if;

  update "HouseholdMember"
  set "displayName" = v_name
  where "userId" = v_uid;
end;
$$;

comment on function public.update_display_name(text) is
  'Updates auth metadata and household display names for the authenticated user.';

revoke all on function public.update_display_name(text) from public, anon;
grant execute on function public.update_display_name(text) to authenticated, service_role;
