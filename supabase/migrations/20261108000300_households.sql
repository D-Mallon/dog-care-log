-- ============================================================================
-- Loggi household RPCs, storage policies and realtime publication
-- ----------------------------------------------------------------------------
-- All household membership writes go through the SECURITY DEFINER functions in
-- this file. Clients only have SELECT on "Household"/"HouseholdMember" (plus
-- UPDATE(name) on "Household"), so they cannot insert themselves as owner or
-- edit another member's role.
--
-- Every RPC:
--   * checks auth.uid() first;
--   * uses the caller's active membership, never a caller-supplied household id;
--   * runs as the function owner, bypassing RLS only for its own atomic write;
--   * is revoked from PUBLIC/anon and granted to authenticated.
-- ============================================================================

-- ============================================================================
-- Internal helpers
-- ============================================================================

-- Six characters from an unambiguous 32-character alphabet. The bytes come
-- from gen_random_uuid(), which PostgreSQL 13+ generates with a strong random
-- source. 32 divides 256 exactly, so modulo does not bias the alphabet.
-- Excludes I, O, 0 and 1 to make codes easier to read/type.
create or replace function public.generate_invite_code()
returns text
language sql
volatile
set search_path = public
as $$
  with entropy as (
    select decode(replace(gen_random_uuid()::text, '-', ''), 'hex') as bytes
  )
  select string_agg(
    substr(
      'ABCDEFGHJKLMNPQRSTUVWXYZ23456789',
      (get_byte(bytes, i) % 32) + 1,
      1
    ),
    ''
    order by i
  )
  from entropy
  cross join generate_series(0, 5) as i;
$$;

comment on function public.generate_invite_code() is
  'Internal: cryptographically random 6-character uppercase invite code. Not granted to clients.';

-- Best-effort display name captured at create/join time. Auth UI metadata
-- conventions vary, so try display_name, full_name, name, then the email local
-- part. Always returns 1..80 characters.
create or replace function public.default_display_name()
returns text
language sql
stable
set search_path = public
as $$
  select left(
    coalesce(
      nullif(btrim(auth.jwt() -> 'user_metadata' ->> 'display_name'), ''),
      nullif(btrim(auth.jwt() -> 'user_metadata' ->> 'full_name'), ''),
      nullif(btrim(auth.jwt() -> 'user_metadata' ->> 'name'), ''),
      nullif(btrim(split_part(coalesce(auth.jwt() ->> 'email', ''), '@', 1)), ''),
      'Member'
    ),
    80
  );
$$;

comment on function public.default_display_name() is
  'Internal: derives a display name from auth metadata with a safe fallback.';

revoke all on function public.generate_invite_code() from public, anon, authenticated, service_role;
revoke all on function public.default_display_name() from public, anon, authenticated, service_role;

-- ============================================================================
-- create_household(p_name text) -> "Household"
-- ============================================================================
-- Rejects users who already have an active membership, generates a unique
-- invite code server-side, and inserts the Household plus the owner membership
-- atomically. The partial unique index on HouseholdMember(userId) is the final
-- concurrency guard.
create or replace function public.create_household(p_name text)
returns "Household"
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_name text := btrim(coalesce(p_name, ''));
  v_code text;
  v_household "Household"%rowtype;
  v_attempt integer;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  if char_length(v_name) = 0 then
    raise exception 'Household name is required' using errcode = '22023';
  end if;

  if char_length(v_name) > 80 then
    raise exception 'Household name must be 80 characters or fewer'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from "HouseholdMember" m
    where m."userId" = v_uid
      and m.status = 'active'
  ) then
    raise exception 'You already belong to an active household'
      using errcode = '23505';
  end if;

  for v_attempt in 1..10 loop
    v_code := public.generate_invite_code();

    begin
      insert into "Household" (name, "inviteCode", "createdBy")
      values (v_name, v_code, v_uid)
      returning * into v_household;

      exit;
    exception
      when unique_violation then
        -- Extremely unlikely; retry with a new code. On the last attempt,
        -- surface the original unique violation.
        if v_attempt = 10 then
          raise exception 'Could not generate a unique invite code. Please try again.'
            using errcode = '23505';
        end if;
    end;
  end loop;

  begin
    insert into "HouseholdMember"
      ("householdId", "userId", role, status, "displayName")
    values
      (v_household.id, v_uid, 'owner', 'active', public.default_display_name());
  exception
    when unique_violation then
      -- A concurrent create_household() won the one-active-household race.
      raise exception 'You already belong to an active household'
        using errcode = '23505';
  end;

  return v_household;
end;
$$;

comment on function public.create_household(text) is
  'Atomically creates a household and its owner membership. Rejects users who are already in an active household.';

-- ============================================================================
-- join_household(p_code text) -> "Household"
-- ============================================================================
-- The only way to join: callers cannot choose role/status. The code is
-- normalized to uppercase, one active household is enforced, and displayName
-- is captured from auth metadata.
create or replace function public.join_household(p_code text)
returns "Household"
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_code text := upper(btrim(coalesce(p_code, '')));
  v_household "Household"%rowtype;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  if v_code !~ '^[A-Z0-9]{6}$' then
    raise exception 'Invalid invite code' using errcode = '22023';
  end if;

  if exists (
    select 1
    from "HouseholdMember" m
    where m."userId" = v_uid
      and m.status = 'active'
  ) then
    raise exception 'You already belong to an active household'
      using errcode = '23505';
  end if;

  select *
  into v_household
  from "Household" h
  where h."inviteCode" = v_code;

  if not found then
    raise exception 'Invite code not found' using errcode = 'P0002';
  end if;

  begin
    insert into "HouseholdMember"
      ("householdId", "userId", role, status, "displayName")
    values
      (v_household.id, v_uid, 'member', 'active', public.default_display_name());
  exception
    when unique_violation then
      -- Either another request activated this user first, or a legacy pending
      -- row already exists for this household. Release 1 treats both as
      -- "already a member".
      raise exception 'You already belong to an active household'
        using errcode = '23505';
  end;

  return v_household;
end;
$$;

comment on function public.join_household(text) is
  'Joins a household by invite code as an active member. Role/status are server-controlled.';

-- ============================================================================
-- leave_household() -> void
-- ============================================================================
-- Members may leave. An owner cannot leave in Release 1: there is no ownership
-- transfer flow yet, and deleting the owner would orphan the household. Owners
-- must contact support to transfer or delete the household.
create or replace function public.leave_household()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_member "HouseholdMember"%rowtype;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  select *
  into v_member
  from "HouseholdMember" m
  where m."userId" = v_uid
    and m.status = 'active'
  limit 1;

  if not found then
    raise exception 'You are not in an active household' using errcode = 'P0002';
  end if;

  if v_member.role = 'owner' then
    raise exception 'Household owners cannot leave. Transfer ownership or delete the household via support.'
      using errcode = '42501';
  end if;

  delete from "HouseholdMember"
  where "householdId" = v_member."householdId"
    and "userId" = v_uid;
end;
$$;

comment on function public.leave_household() is
  'Removes the caller''s active membership. Owners are rejected in Release 1 to avoid orphaned households.';

-- ============================================================================
-- remove_household_member(p_user_id uuid) -> void
-- ============================================================================
-- Owner-only, and an owner cannot remove themselves (use support / household
-- deletion instead). The target must be in the caller's household.
create or replace function public.remove_household_member(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_household_id uuid;
  v_target "HouseholdMember"%rowtype;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  if p_user_id is null then
    raise exception 'User id is required' using errcode = '22023';
  end if;

  if p_user_id = v_uid then
    raise exception 'You cannot remove yourself. Use leave_household() instead.'
      using errcode = '22023';
  end if;

  select m."householdId"
  into v_household_id
  from "HouseholdMember" m
  where m."userId" = v_uid
    and m.status = 'active'
  limit 1;

  if not found then
    raise exception 'You are not in an active household' using errcode = 'P0002';
  end if;

  if not public.is_household_owner(v_household_id) then
    raise exception 'Only household owners can remove members'
      using errcode = '42501';
  end if;

  select *
  into v_target
  from "HouseholdMember" m
  where m."householdId" = v_household_id
    and m."userId" = p_user_id;

  if not found then
    raise exception 'That user is not a member of your household'
      using errcode = 'P0002';
  end if;

  delete from "HouseholdMember"
  where "householdId" = v_household_id
    and "userId" = p_user_id;
end;
$$;

comment on function public.remove_household_member(uuid) is
  'Owner-only removal of a member from the caller''s household. Cannot remove self.';

-- ============================================================================
-- rename_household(p_name text) -> "Household"
-- ============================================================================
create or replace function public.rename_household(p_name text)
returns "Household"
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_name text := btrim(coalesce(p_name, ''));
  v_household_id uuid;
  v_household "Household"%rowtype;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  if char_length(v_name) = 0 then
    raise exception 'Household name is required' using errcode = '22023';
  end if;

  if char_length(v_name) > 80 then
    raise exception 'Household name must be 80 characters or fewer'
      using errcode = '22023';
  end if;

  select m."householdId"
  into v_household_id
  from "HouseholdMember" m
  where m."userId" = v_uid
    and m.status = 'active'
  limit 1;

  if not found then
    raise exception 'You are not in an active household' using errcode = 'P0002';
  end if;

  if not public.is_household_owner(v_household_id) then
    raise exception 'Only household owners can rename the household'
      using errcode = '42501';
  end if;

  update "Household"
  set name = v_name
  where id = v_household_id
  returning * into v_household;

  if not found then
    raise exception 'Household not found' using errcode = 'P0002';
  end if;

  return v_household;
end;
$$;

comment on function public.rename_household(text) is
  'Owner-only rename. Returns the updated Household row.';

-- ============================================================================
-- regenerate_invite_code() -> text
-- ============================================================================
create or replace function public.regenerate_invite_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_household_id uuid;
  v_code text;
  v_attempt integer;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  select m."householdId"
  into v_household_id
  from "HouseholdMember" m
  where m."userId" = v_uid
    and m.status = 'active'
  limit 1;

  if not found then
    raise exception 'You are not in an active household' using errcode = 'P0002';
  end if;

  if not public.is_household_owner(v_household_id) then
    raise exception 'Only household owners can regenerate the invite code'
      using errcode = '42501';
  end if;

  for v_attempt in 1..10 loop
    v_code := public.generate_invite_code();

    begin
      update "Household"
      set "inviteCode" = v_code
      where id = v_household_id;

      return v_code;
    exception
      when unique_violation then
        if v_attempt = 10 then
          raise exception 'Could not generate a unique invite code. Please try again.'
            using errcode = '23505';
        end if;
    end;
  end loop;

  raise exception 'Could not generate a unique invite code. Please try again.'
    using errcode = '23505';
end;
$$;

comment on function public.regenerate_invite_code() is
  'Owner-only rotation of the household invite code. Returns the new code.';

-- ============================================================================
-- update_my_display_name(p_name text) -> void
-- ============================================================================
-- Optional convenience RPC so a member can correct the "Logged by" name without
-- editing auth metadata.
create or replace function public.update_my_display_name(p_name text)
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

  if char_length(v_name) = 0 then
    raise exception 'Display name is required' using errcode = '22023';
  end if;

  if char_length(v_name) > 80 then
    raise exception 'Display name must be 80 characters or fewer'
      using errcode = '22023';
  end if;

  update "HouseholdMember"
  set "displayName" = v_name
  where "userId" = v_uid
    and status = 'active';

  if not found then
    raise exception 'You are not in an active household' using errcode = 'P0002';
  end if;
end;
$$;

comment on function public.update_my_display_name(text) is
  'Allows an active member to update their own display name.';

-- ============================================================================
-- RPC privileges
-- ============================================================================
revoke all on function public.create_household(text) from public, anon, authenticated;
revoke all on function public.join_household(text) from public, anon, authenticated;
revoke all on function public.leave_household() from public, anon, authenticated;
revoke all on function public.remove_household_member(uuid) from public, anon, authenticated;
revoke all on function public.rename_household(text) from public, anon, authenticated;
revoke all on function public.regenerate_invite_code() from public, anon, authenticated;
revoke all on function public.update_my_display_name(text) from public, anon, authenticated;

grant execute on function public.create_household(text) to authenticated, service_role;
grant execute on function public.join_household(text) to authenticated, service_role;
grant execute on function public.leave_household() to authenticated, service_role;
grant execute on function public.remove_household_member(uuid) to authenticated, service_role;
grant execute on function public.rename_household(text) to authenticated, service_role;
grant execute on function public.regenerate_invite_code() to authenticated, service_role;
grant execute on function public.update_my_display_name(text) to authenticated, service_role;

-- ============================================================================
-- Storage: dog-images bucket
-- ============================================================================
-- The bucket is public so dog photos can be rendered with a plain public URL.
-- Writes are still RLS-scoped to the uploader's active household, using the
-- object name convention `<householdId>/<file>`. The membership helper compares
-- text, so a malformed path cannot trigger an invalid-uuid error.
insert into storage.buckets (id, name, public)
values ('dog-images', 'dog-images', true)
on conflict (id) do nothing;

-- Ensure an existing bucket is public even if this migration is applied over a
-- bucket created by the legacy migration.sql.
update storage.buckets
set public = true
where id = 'dog-images';

-- Remove the legacy wide-open policy if it exists. The old policy allowed any
-- role to INSERT/UPDATE/DELETE every object in the bucket.
drop policy if exists "Public Access" on storage.objects;
drop policy if exists "dog_images_public_read" on storage.objects;
drop policy if exists "dog_images_insert_household_members" on storage.objects;
drop policy if exists "dog_images_update_household_members" on storage.objects;
drop policy if exists "dog_images_delete_household_members" on storage.objects;

-- Public read is intentional for this bucket: object URLs are unguessable and
-- the images are dog photos, not private documents.
create policy "dog_images_public_read"
  on storage.objects
  for select
  using (bucket_id = 'dog-images');

-- Authenticated users may upload only under a household they actively belong
-- to. split_part(name, '/', 1) is the household id segment; no uuid cast is
-- performed on the path.
create policy "dog_images_insert_household_members"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'dog-images'
    and public.is_household_member_text(split_part(name, '/', 1))
  );

-- Renames/moves are allowed only while both the old and new names stay inside
-- a household the caller actively belongs to.
create policy "dog_images_update_household_members"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'dog-images'
    and public.is_household_member_text(split_part(name, '/', 1))
  )
  with check (
    bucket_id = 'dog-images'
    and public.is_household_member_text(split_part(name, '/', 1))
  );

-- Any active member of the household may remove a photo; this matches the app's
-- current "members can edit dogs" behaviour. Dog deletion itself is owner-only.
create policy "dog_images_delete_household_members"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'dog-images'
    and public.is_household_member_text(split_part(name, '/', 1))
  );

-- ============================================================================
-- Realtime publication
-- ============================================================================
-- Add DogEvent and WeightLog to Supabase Realtime exactly once. The
-- pg_publication_tables check makes this safe to re-run and safe on databases
-- where the publication already contains one of the tables.
do $$
begin
  if not exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) then
    execute 'create publication supabase_realtime';
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'DogEvent'
  ) then
    execute 'alter publication supabase_realtime add table "DogEvent"';
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'WeightLog'
  ) then
    execute 'alter publication supabase_realtime add table "WeightLog"';
  end if;
end
$$;
