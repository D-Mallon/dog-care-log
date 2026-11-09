-- ============================================================================
-- Recurring care schedules and task completions
-- ----------------------------------------------------------------------------
-- "CareSchedule" is a household-defined routine (feed/walk/toilet/meds/etc.)
-- and "CareTaskCompletion" records one member ticking off one due occurrence.
-- The unique (scheduleId, dueDate) key makes "complete" idempotent, and
-- eventId optionally links the completion to the DogEvent created alongside it.
--
-- `createdBy`/`completedBy` intentionally have no FK to auth.users, matching
-- the rest of the schema (account deletion is handled explicitly).
-- ============================================================================

create table if not exists "CareSchedule" (
  id uuid primary key default gen_random_uuid(),
  "householdId" uuid not null references "Household"(id) on delete cascade,
  "dogId" uuid not null references "Dogs"("dogId") on delete cascade,
  type text not null,
  title text not null,
  "timeOfDay" time not null,
  recurrence text not null,
  active boolean not null default true,
  "assignedTo" uuid,
  "createdBy" uuid not null,
  "createdAt" timestamptz not null default now(),
  "startDate" date not null default current_date,
  "endDate" date,

  constraint "CareSchedule_type_check"
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
  constraint "CareSchedule_title_check"
    check (char_length(btrim(title)) between 1 and 80),
  constraint "CareSchedule_recurrence_check"
    check (recurrence in ('daily', 'weekdays', 'weekends', 'weekly', 'once')),
  constraint "CareSchedule_date_range_check"
    check ("endDate" is null or "endDate" >= "startDate")
);

comment on table "CareSchedule" is
  'Recurring household care routine. A schedule always belongs to one dog in the same household.';
comment on column "CareSchedule"."timeOfDay" is
  'Local wall-clock time for the routine. Household timezone handling is a later migration.';
comment on column "CareSchedule"."assignedTo" is
  'Optional auth.users id of the member expected to do the task. No FK, matching the rest of the schema.';

create table if not exists "CareTaskCompletion" (
  id uuid primary key default gen_random_uuid(),
  "scheduleId" uuid not null references "CareSchedule"(id) on delete cascade,
  "dueDate" date not null,
  "completedBy" uuid not null,
  "completedAt" timestamptz not null default now(),
  "eventId" uuid references "DogEvent"(id) on delete set null,

  -- One completion per schedule per due day. Also provides the
  -- CareTaskCompletion(scheduleId, dueDate) lookup index.
  constraint "CareTaskCompletion_schedule_due_key"
    unique ("scheduleId", "dueDate")
);

comment on table "CareTaskCompletion" is
  'A member completion of one due occurrence. Unique per schedule and dueDate.';
comment on column "CareTaskCompletion"."eventId" is
  'Optional care event logged at completion time; cleared if that event is deleted.';

create index if not exists "CareSchedule_dogId_idx"
  on "CareSchedule" ("dogId");

create index if not exists "CareSchedule_householdId_idx"
  on "CareSchedule" ("householdId");

-- ============================================================================
-- SECURITY DEFINER helpers
-- ----------------------------------------------------------------------------
-- Policies must not query "Dogs"/"CareSchedule" directly, otherwise their RLS
-- would recursively apply. These helpers only return a boolean for auth.uid().
-- ============================================================================

-- True when the dog exists and is owned by the given household. Callers still
-- combine this with is_household_member(householdId) in the policy, so a
-- schedule cannot be pointed at another household's dog.
create or replace function public.is_dog_in_household(did uuid, hid uuid)
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
      and d."householdId" = hid
  );
$$;

comment on function public.is_dog_in_household(uuid, uuid) is
  'True when the dog exists in that household. Used by CareSchedule RLS; bypasses Dogs RLS to avoid recursion.';

-- True when auth.uid() is an active member of the schedule's household.
create or replace function public.is_schedule_member(sid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from "CareSchedule" s
    where s.id = sid
      and public.is_household_member(s."householdId")
  );
$$;

comment on function public.is_schedule_member(uuid) is
  'True when auth.uid() is an active member of the schedule household. Used by CareTaskCompletion RLS.';

revoke all on function public.is_dog_in_household(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.is_schedule_member(uuid)
  from public, anon, authenticated;

grant execute on function public.is_dog_in_household(uuid, uuid)
  to authenticated, service_role;
grant execute on function public.is_schedule_member(uuid)
  to authenticated, service_role;

-- ============================================================================
-- Row Level Security
-- ============================================================================

alter table "CareSchedule" enable row level security;
alter table "CareTaskCompletion" enable row level security;

-- ---------------------------------------------------------------------------
-- CareSchedule
-- ---------------------------------------------------------------------------
-- Active household members manage schedules. The WITH CHECK repeats the
-- household + dog ownership rule, so a member cannot move a schedule to a dog
-- outside the schedule household. householdId is trusted only after this
-- check; clients cannot attach schedules to someone else's household.
drop policy if exists "care_schedule_select_members" on "CareSchedule";
create policy "care_schedule_select_members"
  on "CareSchedule"
  for select
  to authenticated
  using (public.is_household_member("householdId"));

drop policy if exists "care_schedule_insert_members" on "CareSchedule";
create policy "care_schedule_insert_members"
  on "CareSchedule"
  for insert
  to authenticated
  with check (
    public.is_household_member("householdId")
    and public.is_dog_in_household("dogId", "householdId")
  );

drop policy if exists "care_schedule_update_members" on "CareSchedule";
create policy "care_schedule_update_members"
  on "CareSchedule"
  for update
  to authenticated
  using (
    public.is_household_member("householdId")
    and public.is_dog_in_household("dogId", "householdId")
  )
  with check (
    public.is_household_member("householdId")
    and public.is_dog_in_household("dogId", "householdId")
  );

drop policy if exists "care_schedule_delete_members" on "CareSchedule";
create policy "care_schedule_delete_members"
  on "CareSchedule"
  for delete
  to authenticated
  using (public.is_household_member("householdId"));

-- ---------------------------------------------------------------------------
-- CareTaskCompletion
-- ---------------------------------------------------------------------------
-- Members can read completions for their schedules. A completion is always
-- attributed to the caller: inserts and updates cannot set completedBy to
-- somebody else. Any member can delete a completion (for example to undo a
-- mistaken tap).
drop policy if exists "care_task_completion_select_members" on "CareTaskCompletion";
create policy "care_task_completion_select_members"
  on "CareTaskCompletion"
  for select
  to authenticated
  using (public.is_schedule_member("scheduleId"));

drop policy if exists "care_task_completion_insert_members" on "CareTaskCompletion";
create policy "care_task_completion_insert_members"
  on "CareTaskCompletion"
  for insert
  to authenticated
  with check (
    public.is_schedule_member("scheduleId")
    and "completedBy" = auth.uid()
  );

drop policy if exists "care_task_completion_update_members" on "CareTaskCompletion";
create policy "care_task_completion_update_members"
  on "CareTaskCompletion"
  for update
  to authenticated
  using (public.is_schedule_member("scheduleId"))
  with check (
    public.is_schedule_member("scheduleId")
    and "completedBy" = auth.uid()
  );

drop policy if exists "care_task_completion_delete_members" on "CareTaskCompletion";
create policy "care_task_completion_delete_members"
  on "CareTaskCompletion"
  for delete
  to authenticated
  using (public.is_schedule_member("scheduleId"));

-- ============================================================================
-- Privileges
-- ============================================================================

revoke all on "CareSchedule" from anon, authenticated;
grant select, insert, update, delete on "CareSchedule" to authenticated;
grant all on "CareSchedule" to service_role;

revoke all on "CareTaskCompletion" from anon, authenticated;
grant select, insert, update, delete on "CareTaskCompletion" to authenticated;
grant all on "CareTaskCompletion" to service_role;

-- ============================================================================
-- Realtime publication
-- ============================================================================
-- Idempotent, mirroring the helper in 20261108000300_households.sql: the
-- pg_publication_tables check makes this safe to re-run and safe on a database
-- that already has the publication.
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
      and tablename = 'CareSchedule'
  ) then
    execute 'alter publication supabase_realtime add table "CareSchedule"';
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'CareTaskCompletion'
  ) then
    execute 'alter publication supabase_realtime add table "CareTaskCompletion"';
  end if;
end
$$;
