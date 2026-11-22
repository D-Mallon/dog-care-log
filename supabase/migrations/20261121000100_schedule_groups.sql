-- ============================================================================
-- Care schedule groups
-- ----------------------------------------------------------------------------
-- A routine such as "Walk all dogs" can apply to several dogs. Each dog keeps
-- its own CareSchedule row so the existing per-dog RLS, events and reports
-- continue to work, but rows created together share a groupId.
--
-- A group is completed as one action: the app upserts/deletes one
-- CareTaskCompletion row per schedule in the group. Existing schedules get a
-- unique groupId, so they behave exactly as before.
-- ============================================================================

alter table "CareSchedule"
  add column if not exists "groupId" uuid not null default gen_random_uuid();

create index if not exists "CareSchedule_groupId_idx"
  on "CareSchedule" ("groupId");

comment on column "CareSchedule"."groupId" is
  'Rows created as one multi-dog routine share this id. A single-dog routine has its own group.';
