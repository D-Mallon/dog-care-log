-- ============================================================================
-- Loggi core schema
-- ----------------------------------------------------------------------------
-- This migration creates the household, dog, care-event and weight tables,
-- the SECURITY DEFINER helpers used by RLS, the core RLS policies and the
-- indexes needed by the app.
--
-- It is written for a fresh database (the Supabase project has never held
-- live data). It does NOT drop tables. To rebuild a dev database, use
-- `supabase db reset`; never run the old supabase/migration.sql in production.
--
-- Quoted CamelCase table/column names are intentional: the React app and the
-- generated Supabase types use these exact identifiers.
-- ============================================================================

-- The app only uses pg_catalog.gen_random_uuid() (PostgreSQL 13+), so no
-- extension needs to be installed for this schema.
grant usage on schema public to anon, authenticated, service_role;

-- ============================================================================
-- Tables
-- ============================================================================

create table "Household" (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  "inviteCode" text not null,
  "createdBy" uuid not null,
  "createdAt" timestamptz not null default now(),

  constraint "Household_name_not_blank"
    check (char_length(btrim(name)) between 1 and 80),
  constraint "Household_inviteCode_format"
    check ("inviteCode" ~ '^[A-Z0-9]{6}$'),
  constraint "Household_inviteCode_key" unique ("inviteCode")
);

comment on table "Household" is
  'A shared dog-care household. Rows are created by create_household() only.';
comment on column "Household"."createdBy" is
  'auth.users.id of the owner who created the household.';

-- Membership join table. The primary key intentionally allows a user to
-- belong to different households over time (for example after leaving), while
-- the partial unique index below enforces the Release 1 rule of one *active*
-- household per user.
create table "HouseholdMember" (
  "householdId" uuid not null references "Household"(id) on delete cascade,
  "userId" uuid not null,
  role text not null default 'member',
  status text not null default 'pending',
  "joinedAt" timestamptz not null default now(),
  "displayName" text,

  primary key ("householdId", "userId"),
  constraint "HouseholdMember_role_check"
    check (role in ('owner', 'member')),
  constraint "HouseholdMember_status_check"
    check (status in ('active', 'pending')),
  constraint "HouseholdMember_displayName_check"
    check (
      "displayName" is null
      or char_length(btrim("displayName")) between 1 and 80
    )
);

comment on table "HouseholdMember" is
  'Membership and role for a household. Writes are RPC-only (no INSERT/UPDATE/DELETE policies or grants for clients).';
comment on column "HouseholdMember"."displayName" is
  'Human-readable name shown as “Logged by …”. Captured from auth metadata on create/join.';

create table "Dogs" (
  "dogId" uuid primary key default gen_random_uuid(),
  "dogName" text not null,
  "householdId" uuid not null references "Household"(id) on delete cascade,
  breed text,
  age integer,
  weight numeric,
  notes text,
  "dogImage" text not null default '',

  constraint "Dogs_dogName_not_blank"
    check (char_length(btrim("dogName")) > 0),
  constraint "Dogs_age_range"
    check (age is null or (age >= 0 and age <= 30)),
  constraint "Dogs_weight_positive"
    check (weight is null or weight > 0)
);

comment on table "Dogs" is
  'Dogs belonging to a household. Household members can manage them; deletion is owner-only.';

create table "DogEvent" (
  id uuid primary key default gen_random_uuid(),
  "dogId" uuid not null references "Dogs"("dogId") on delete cascade,
  type text not null,
  subtype text,
  "isAccident" boolean not null default false,
  "timestamp" timestamptz not null default now(),
  "userId" uuid not null default auth.uid(),
  note text,

  constraint "DogEvent_type_check"
    check (type in (
      'feed',
      'walk',
      'toilet',
      'meds',
      'sick',
      'nap_time',
      'play_time',
      'water',
      'grooming'
    )),
  -- Only toilet events currently have a subtype. Keeping the type/subtype
  -- relationship in the database prevents nonsense such as a “feed” with a
  -- “pee” subtype.
  constraint "DogEvent_subtype_check"
    check (
      subtype is null
      or (type = 'toilet' and subtype in ('pee', 'poo', 'other'))
    )
);

comment on table "DogEvent" is
  'Care events logged against a dog. userId defaults to auth.uid() so clients cannot spoof another author.';

create table "WeightLog" (
  id uuid primary key default gen_random_uuid(),
  "dogId" uuid not null references "Dogs"("dogId") on delete cascade,
  weight numeric not null,
  "recordedAt" timestamptz not null default now(),
  "userId" uuid not null default auth.uid(),

  constraint "WeightLog_weight_positive"
    check (weight > 0)
);

comment on table "WeightLog" is
  'Weight history for a dog. userId defaults to auth.uid(); the initial row is backfilled from Dogs.weight below.';

-- ============================================================================
-- Indexes
-- ============================================================================

-- One active household per user (Release 1 policy). The partial index is both
-- the business rule and the concurrency guard for create_household() /
-- join_household().
create unique index "HouseholdMember_one_active_per_user_idx"
  on "HouseholdMember" ("userId")
  where status = 'active';

create index "HouseholdMember_userId_idx"
  on "HouseholdMember" ("userId");

create index "HouseholdMember_householdId_idx"
  on "HouseholdMember" ("householdId");

create index "Dogs_householdId_idx"
  on "Dogs" ("householdId");

create index "DogEvent_dogId_timestamp_idx"
  on "DogEvent" ("dogId", "timestamp" desc);

create index "DogEvent_timestamp_idx"
  on "DogEvent" ("timestamp");

create index "WeightLog_dogId_recordedAt_idx"
  on "WeightLog" ("dogId", "recordedAt" desc);

-- ============================================================================
-- SECURITY DEFINER helpers
-- ----------------------------------------------------------------------------
-- RLS policies must not query "HouseholdMember" or "Dogs" directly: doing so
-- would recursively invoke their own RLS policies. These helpers are owned by
-- the migration role (the table owner), so they bypass RLS, and they only ever
-- return a boolean for the caller in auth.uid(). Every function pins
-- search_path to prevent object-shadowing attacks.
--
-- These helpers are NOT the public API. They are granted to authenticated
-- because policy expressions run as the calling role; clients can call them,
-- but they reveal no rows, only “is this user a member/owner?”.
-- ============================================================================

create or replace function public.is_household_member(hid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from "HouseholdMember" m
      where m."householdId" = hid
        and m."userId" = auth.uid()
        and m.status = 'active'
    );
$$;

comment on function public.is_household_member(uuid) is
  'True when auth.uid() is an active member of the household. Used by RLS; bypasses HouseholdMember RLS to avoid recursion.';

create or replace function public.is_household_owner(hid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from "HouseholdMember" m
      where m."householdId" = hid
        and m."userId" = auth.uid()
        and m.role = 'owner'
        and m.status = 'active'
    );
$$;

comment on function public.is_household_owner(uuid) is
  'True when auth.uid() is an active owner of the household. Used by RLS and owner-only RPCs.';

create or replace function public.is_dog_member(did uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from "Dogs" d
    where d."dogId" = did
      and public.is_household_member(d."householdId")
  );
$$;

comment on function public.is_dog_member(uuid) is
  'True when the dog exists and auth.uid() is an active member of its household.';

create or replace function public.is_dog_owner(did uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from "Dogs" d
    where d."dogId" = did
      and public.is_household_owner(d."householdId")
  );
$$;

comment on function public.is_dog_owner(uuid) is
  'True when the dog exists and auth.uid() is an active owner of its household.';

-- Storage object names are `<householdId>/<file>`. Comparing UUIDs as text
-- means a malformed path segment returns false instead of raising a cast
-- error inside a storage policy.
create or replace function public.is_household_member_text(hid text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from "HouseholdMember" m
      where m."householdId"::text = lower(hid)
        and m."userId" = auth.uid()
        and m.status = 'active'
    );
$$;

comment on function public.is_household_member_text(text) is
  'Text-safe membership check for storage paths. Never casts the caller-supplied path to uuid.';

-- Lock the helper API down: authenticated needs EXECUTE for policies, but
-- nothing else should call these directly.
revoke all on function public.is_household_member(uuid) from public, anon, authenticated;
revoke all on function public.is_household_owner(uuid) from public, anon, authenticated;
revoke all on function public.is_dog_member(uuid) from public, anon, authenticated;
revoke all on function public.is_dog_owner(uuid) from public, anon, authenticated;
revoke all on function public.is_household_member_text(text) from public, anon, authenticated;

grant execute on function public.is_household_member(uuid) to authenticated, service_role;
grant execute on function public.is_household_owner(uuid) to authenticated, service_role;
grant execute on function public.is_dog_member(uuid) to authenticated, service_role;
grant execute on function public.is_dog_owner(uuid) to authenticated, service_role;
grant execute on function public.is_household_member_text(text) to authenticated, service_role;

-- ============================================================================
-- Row Level Security
-- ============================================================================

alter table "Household" enable row level security;
alter table "HouseholdMember" enable row level security;
alter table "Dogs" enable row level security;
alter table "DogEvent" enable row level security;
alter table "WeightLog" enable row level security;

-- ---------------------------------------------------------------------------
-- Household
-- ---------------------------------------------------------------------------
-- Members can read their household. Only owners can update it; creation and
-- deletion are RPC-only, so there is deliberately no INSERT or DELETE policy.
drop policy if exists "household_select_members" on "Household";
create policy "household_select_members"
  on "Household"
  for select
  to authenticated
  using (public.is_household_member(id));

drop policy if exists "household_update_owners" on "Household";
create policy "household_update_owners"
  on "Household"
  for update
  to authenticated
  using (public.is_household_owner(id))
  with check (public.is_household_owner(id));

-- ---------------------------------------------------------------------------
-- HouseholdMember
-- ---------------------------------------------------------------------------
-- Active members can see everyone in their own household (including pending
-- rows, if any). There are no client INSERT/UPDATE/DELETE policies: joining,
-- leaving, removing, renaming and code regeneration all go through the
-- SECURITY DEFINER RPCs in 20261108000300_households.sql. That prevents a
-- client from inserting itself as owner or editing another member's role.
drop policy if exists "household_member_select_same_household" on "HouseholdMember";
create policy "household_member_select_same_household"
  on "HouseholdMember"
  for select
  to authenticated
  using (public.is_household_member("householdId"));

-- ---------------------------------------------------------------------------
-- Dogs
-- ---------------------------------------------------------------------------
-- All active household members can read and manage dogs. Deletion is reserved
-- for owners (a destructive action in the app).
drop policy if exists "dogs_select_members" on "Dogs";
create policy "dogs_select_members"
  on "Dogs"
  for select
  to authenticated
  using (public.is_household_member("householdId"));

drop policy if exists "dogs_insert_members" on "Dogs";
create policy "dogs_insert_members"
  on "Dogs"
  for insert
  to authenticated
  with check (public.is_household_member("householdId"));

drop policy if exists "dogs_update_members" on "Dogs";
create policy "dogs_update_members"
  on "Dogs"
  for update
  to authenticated
  using (public.is_household_member("householdId"))
  with check (public.is_household_member("householdId"));

drop policy if exists "dogs_delete_owners" on "Dogs";
create policy "dogs_delete_owners"
  on "Dogs"
  for delete
  to authenticated
  using (public.is_household_owner("householdId"));

-- ---------------------------------------------------------------------------
-- DogEvent
-- ---------------------------------------------------------------------------
-- Members read events for dogs in their household. Inserts must target one of
-- their dogs AND set userId to the caller, so authorship cannot be forged.
-- Updates/deletes are allowed for the author or any owner of the dog's
-- household. The WITH CHECK repeats the authorship rule: a normal author
-- cannot reassign an event to someone else, while an owner can correct records.
drop policy if exists "dog_event_select_members" on "DogEvent";
create policy "dog_event_select_members"
  on "DogEvent"
  for select
  to authenticated
  using (public.is_dog_member("dogId"));

drop policy if exists "dog_event_insert_members" on "DogEvent";
create policy "dog_event_insert_members"
  on "DogEvent"
  for insert
  to authenticated
  with check (
    public.is_dog_member("dogId")
    and "userId" = auth.uid()
  );

drop policy if exists "dog_event_update_author_or_owner" on "DogEvent";
create policy "dog_event_update_author_or_owner"
  on "DogEvent"
  for update
  to authenticated
  using (
    public.is_dog_member("dogId")
    and ("userId" = auth.uid() or public.is_dog_owner("dogId"))
  )
  with check (
    public.is_dog_member("dogId")
    and ("userId" = auth.uid() or public.is_dog_owner("dogId"))
  );

drop policy if exists "dog_event_delete_author_or_owner" on "DogEvent";
create policy "dog_event_delete_author_or_owner"
  on "DogEvent"
  for delete
  to authenticated
  using (
    public.is_dog_member("dogId")
    and ("userId" = auth.uid() or public.is_dog_owner("dogId"))
  );

-- ---------------------------------------------------------------------------
-- WeightLog
-- ---------------------------------------------------------------------------
-- Same shape as DogEvent: members can read and add weights, authorship is
-- pinned to auth.uid(), and only the author or a household owner can correct
-- or delete a log.
drop policy if exists "weight_log_select_members" on "WeightLog";
create policy "weight_log_select_members"
  on "WeightLog"
  for select
  to authenticated
  using (public.is_dog_member("dogId"));

drop policy if exists "weight_log_insert_members" on "WeightLog";
create policy "weight_log_insert_members"
  on "WeightLog"
  for insert
  to authenticated
  with check (
    public.is_dog_member("dogId")
    and "userId" = auth.uid()
  );

drop policy if exists "weight_log_update_author_or_owner" on "WeightLog";
create policy "weight_log_update_author_or_owner"
  on "WeightLog"
  for update
  to authenticated
  using (
    public.is_dog_member("dogId")
    and ("userId" = auth.uid() or public.is_dog_owner("dogId"))
  )
  with check (
    public.is_dog_member("dogId")
    and ("userId" = auth.uid() or public.is_dog_owner("dogId"))
  );

drop policy if exists "weight_log_delete_author_or_owner" on "WeightLog";
create policy "weight_log_delete_author_or_owner"
  on "WeightLog"
  for delete
  to authenticated
  using (
    public.is_dog_member("dogId")
    and ("userId" = auth.uid() or public.is_dog_owner("dogId"))
  );

-- ============================================================================
-- Backfill: one initial weight log for dogs that have a weight but no history
-- ============================================================================
-- This is deliberately guarded by NOT EXISTS and is a no-op on a fresh reset.
-- The migration connection has no auth.uid(), so attribute the initial row to
-- the household creator (a real user id) to satisfy WeightLog.userId NOT NULL.
do $$
begin
  insert into "WeightLog" ("dogId", weight, "recordedAt", "userId")
  select d."dogId", d.weight, now(), h."createdBy"
  from "Dogs" d
  join "Household" h on h.id = d."householdId"
  where d.weight is not null
    and d.weight > 0
    and not exists (
      select 1
      from "WeightLog" w
      where w."dogId" = d."dogId"
    );
end
$$;

-- ============================================================================
-- Privileges
-- ----------------------------------------------------------------------------
-- Grants are the second lock behind RLS. Supabase's default privileges may
-- already grant ALL on public tables to anon/authenticated, so every object
-- starts with an explicit REVOKE. The service role bypasses RLS and is used by
-- Edge Functions/webhooks.
--
-- Household and HouseholdMember are intentionally not writable by clients:
--   * Household:     SELECT + UPDATE(name) for authenticated; RPC-only writes.
--   * HouseholdMember: SELECT only; RPC-only writes.
-- Column-level UPDATE on Household prevents an owner from rewriting
-- createdBy/inviteCode directly; invite codes change via regenerate_invite_code().
-- ============================================================================

revoke all on "Household" from anon, authenticated;
grant select on "Household" to authenticated;
grant update ("name") on "Household" to authenticated;
grant all on "Household" to service_role;

revoke all on "HouseholdMember" from anon, authenticated;
grant select on "HouseholdMember" to authenticated;
grant all on "HouseholdMember" to service_role;

revoke all on "Dogs" from anon, authenticated;
grant select, insert, update, delete on "Dogs" to authenticated;
grant all on "Dogs" to service_role;

revoke all on "DogEvent" from anon, authenticated;
grant select, insert, update, delete on "DogEvent" to authenticated;
grant all on "DogEvent" to service_role;

revoke all on "WeightLog" from anon, authenticated;
grant select, insert, update, delete on "WeightLog" to authenticated;
grant all on "WeightLog" to service_role;
