-- ============================================================================
-- Insight feedback labels
-- ----------------------------------------------------------------------------
-- Stores owner-confirmed responses to explainable baseline insights. These are
-- product feedback / future model labels, not diagnoses. Rows are immutable by
-- clients; only household members can read/insert their own feedback.
-- ============================================================================

create table if not exists "InsightFeedback" (
  id uuid primary key default gen_random_uuid(),
  "dogId" uuid not null references "Dogs"("dogId") on delete cascade,
  "householdId" uuid not null references "Household"(id) on delete cascade,
  "insightKey" text not null
    constraint "InsightFeedback_insightKey_length"
    check (char_length(btrim("insightKey")) between 1 and 100),
  "insightKind" text not null
    constraint "InsightFeedback_insightKind_check"
    check (
      "insightKind" in ('feeding', 'water', 'walking', 'potty', 'weight', 'logging')
    ),
  severity text not null
    constraint "InsightFeedback_severity_check"
    check (severity in ('info', 'watch', 'attention')),
  response text not null
    constraint "InsightFeedback_response_check"
    check (response in ('normal', 'unusual', 'vet_visit')),
  note text
    constraint "InsightFeedback_note_length"
    check (note is null or char_length(note) <= 500),
  "userId" uuid not null,
  "createdAt" timestamptz not null default now()
);

create index if not exists "InsightFeedback_dogId_createdAt_idx"
  on "InsightFeedback" ("dogId", "createdAt" desc);

create index if not exists "InsightFeedback_householdId_createdAt_idx"
  on "InsightFeedback" ("householdId", "createdAt" desc);

alter table "InsightFeedback" enable row level security;

drop policy if exists "insight_feedback_select_members" on "InsightFeedback";
create policy "insight_feedback_select_members"
  on "InsightFeedback"
  for select
  to authenticated
  using (is_household_member("householdId"));

drop policy if exists "insight_feedback_insert_members" on "InsightFeedback";
create policy "insight_feedback_insert_members"
  on "InsightFeedback"
  for insert
  to authenticated
  with check (
    "userId" = auth.uid()
    and is_household_member("householdId")
    and is_dog_in_household("dogId", "householdId")
  );

revoke all on table "InsightFeedback" from public, anon, authenticated;
grant select, insert on table "InsightFeedback" to authenticated;
grant all on table "InsightFeedback" to service_role;

comment on table "InsightFeedback" is
  'Owner-confirmed responses to explainable baseline insights; future ML labels, not diagnoses.';

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'InsightFeedback'
  ) then
    alter publication supabase_realtime add table "InsightFeedback";
  end if;
end $$;
