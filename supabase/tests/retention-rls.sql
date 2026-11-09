-- Retention-roadmap RLS checks (dog profile, potty outcomes, schedules, social).
-- Run after local-mocks.sql and all migrations, from the repository root:
--   psql ... -f supabase/tests/retention-rls.sql
--
-- This file creates its own users/households and leaves the database dirty; use
-- a throwaway database. It is not wired into CI because CI already applies
-- every migration and runs free-plan-rls.sql.

\set ON_ERROR_STOP on

-- ---------------------------------------------------------------------------
-- Fixtures: A (owner), B (member of A's household), C (outsider owner)
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config(
  'request.jwt.claim.sub',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  false
);
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","email":"a@example.com","user_metadata":{"full_name":"Alice"}}',
  false
);
select id as household_a from public.create_household('A household') \gset
select set_config('test.household_a', :'household_a', false);

insert into "Dogs" ("dogName", "householdId")
values ('A dog', current_setting('test.household_a')::uuid)
returning "dogId" as dog_a \gset
select set_config('test.dog_a', :'dog_a', false);

reset role;
insert into "HouseholdMember" ("householdId", "userId", role, status, "displayName")
values (
  current_setting('test.household_a')::uuid,
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'member',
  'active',
  'Bob'
);

set role authenticated;
select set_config(
  'request.jwt.claim.sub',
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  false
);
select set_config(
  'request.jwt.claims',
  '{"sub":"cccccccc-cccc-cccc-cccc-cccccccccccc","email":"c@example.com","user_metadata":{"full_name":"Carol"}}',
  false
);
select id as household_c from public.create_household('C household') \gset
select set_config('test.household_c', :'household_c', false);
insert into "Dogs" ("dogName", "householdId")
values ('C dog', current_setting('test.household_c')::uuid)
returning "dogId" as dog_c \gset
select set_config('test.dog_c', :'dog_c', false);

reset role;

-- ---------------------------------------------------------------------------
-- Dog profile constraints
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config(
  'request.jwt.claim.sub',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  false
);

do $$
begin
  if (
    select sex from "Dogs" where "dogId" = current_setting('test.dog_a')::uuid
  ) <> 'unknown' then
    raise exception 'FAIL: Dogs.sex did not default to unknown';
  end if;
  raise notice 'PASS: Dogs.sex defaults to unknown';

  begin
    update "Dogs"
    set sex = 'unspecified'
    where "dogId" = current_setting('test.dog_a')::uuid;
    raise exception 'FAIL: invalid Dogs.sex accepted';
  exception
    when check_violation then
      raise notice 'PASS: invalid Dogs.sex rejected';
  end;

  begin
    update "Dogs"
    set "adultWeightKg" = 0
    where "dogId" = current_setting('test.dog_a')::uuid;
    raise exception 'FAIL: zero adultWeightKg accepted';
  exception
    when check_violation then
      raise notice 'PASS: non-positive adultWeightKg rejected';
  end;
end $$;

-- ---------------------------------------------------------------------------
-- Potty outcome coupling
-- ---------------------------------------------------------------------------
insert into "DogEvent" ("dogId", type, "pottyOutcome", "pottyLocation", "pottyCue")
values (
  current_setting('test.dog_a')::uuid,
  'toilet',
  'success',
  'outside',
  'asked'
)
returning id as event_a \gset
select set_config('test.event_a', :'event_a', false);

do $$
begin
  begin
    update "DogEvent"
    set type = 'feed'
    where id = current_setting('test.event_a')::uuid;
    raise exception 'FAIL: potty fields allowed on a feed event';
  exception
    when check_violation then
      raise notice 'PASS: potty fields coupled to type = toilet';
  end;

  begin
    update "DogEvent"
    set "pottyOutcome" = 'maybe'
    where id = current_setting('test.event_a')::uuid;
    raise exception 'FAIL: invalid pottyOutcome accepted';
  exception
    when check_violation then
      raise notice 'PASS: invalid pottyOutcome rejected';
  end;
end $$;

-- ---------------------------------------------------------------------------
-- Schedules and completions
-- ---------------------------------------------------------------------------
insert into "CareSchedule"
  ("householdId", "dogId", type, title, "timeOfDay", recurrence, "createdBy")
values (
  current_setting('test.household_a')::uuid,
  current_setting('test.dog_a')::uuid,
  'feed',
  'Morning feed',
  '07:30',
  'daily',
  current_setting('request.jwt.claim.sub')::uuid
)
returning id as schedule_a \gset
select set_config('test.schedule_a', :'schedule_a', false);

-- B (member) can complete A's schedule as themselves.
set role authenticated;
select set_config(
  'request.jwt.claim.sub',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  false
);
select set_config(
  'request.jwt.claims',
  '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","email":"b@example.com","user_metadata":{"full_name":"Bob"}}',
  false
);

insert into "CareTaskCompletion" ("scheduleId", "dueDate", "completedBy")
values (
  current_setting('test.schedule_a')::uuid,
  current_date,
  current_setting('request.jwt.claim.sub')::uuid
);
\echo 'PASS: household member can complete a schedule'

do $$
begin
  begin
    insert into "CareTaskCompletion" ("scheduleId", "dueDate", "completedBy")
    values (
      current_setting('test.schedule_a')::uuid,
      current_date + 1,
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    );
    raise exception 'FAIL: forged completedBy accepted';
  exception
    when insufficient_privilege then
      raise notice 'PASS: forged completedBy rejected';
  end;
end $$;

-- C cannot see or write A's schedules.
set role authenticated;
select set_config(
  'request.jwt.claim.sub',
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  false
);
select set_config(
  'request.jwt.claims',
  '{"sub":"cccccccc-cccc-cccc-cccc-cccccccccccc","email":"c@example.com","user_metadata":{"full_name":"Carol"}}',
  false
);

do $$
begin
  if (select count(*) from "CareSchedule") <> 0 then
    raise exception 'FAIL: outsider saw CareSchedule rows';
  end if;
  if (select count(*) from "CareTaskCompletion") <> 0 then
    raise exception 'FAIL: outsider saw CareTaskCompletion rows';
  end if;
  raise notice 'PASS: schedules/completions hidden from outsiders';

  begin
    insert into "CareSchedule"
      ("householdId", "dogId", type, title, "timeOfDay", recurrence, "createdBy")
    values (
      current_setting('test.household_a')::uuid,
      current_setting('test.dog_a')::uuid,
      'walk',
      'Cross-household walk',
      '08:00',
      'daily',
      current_setting('request.jwt.claim.sub')::uuid
    );
    raise exception 'FAIL: cross-household schedule accepted';
  exception
    when insufficient_privilege then
      raise notice 'PASS: cross-household schedule rejected';
  end;

  begin
    insert into "CareSchedule"
      ("householdId", "dogId", type, title, "timeOfDay", recurrence, "createdBy")
    values (
      current_setting('test.household_c')::uuid,
      current_setting('test.dog_a')::uuid,
      'walk',
      'Mis-matched dog walk',
      '08:00',
      'daily',
      current_setting('request.jwt.claim.sub')::uuid
    );
    raise exception 'FAIL: schedule accepted a dog from another household';
  exception
    when insufficient_privilege then
      raise notice 'PASS: schedule dog/household mismatch rejected';
  end;
end $$;

-- ---------------------------------------------------------------------------
-- Event reactions and comments
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config(
  'request.jwt.claim.sub',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  false
);
select set_config(
  'request.jwt.claims',
  '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","email":"b@example.com","user_metadata":{"full_name":"Bob"}}',
  false
);

insert into "EventReaction" ("eventId", "userId", emoji)
values (
  current_setting('test.event_a')::uuid,
  current_setting('request.jwt.claim.sub')::uuid,
  '👍'
);
insert into "EventComment" ("eventId", "userId", body)
values (
  current_setting('test.event_a')::uuid,
  current_setting('request.jwt.claim.sub')::uuid,
  'Nice work'
);
\echo 'PASS: member can react and comment'

do $$
begin
  begin
    insert into "EventReaction" ("eventId", "userId", emoji)
    values (
      current_setting('test.event_a')::uuid,
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      '🎉'
    );
    raise exception 'FAIL: forged reaction userId accepted';
  exception
    when insufficient_privilege then
      raise notice 'PASS: forged reaction userId rejected';
  end;

  begin
    insert into "EventComment" ("eventId", "userId", body)
    values (
      current_setting('test.event_a')::uuid,
      current_setting('request.jwt.claim.sub')::uuid,
      repeat('x', 501)
    );
    raise exception 'FAIL: 501-character comment accepted';
  exception
    when check_violation then
      raise notice 'PASS: over-long comment rejected';
  end;

  begin
    insert into "EventReaction" ("eventId", "userId", emoji)
    values (
      current_setting('test.event_a')::uuid,
      current_setting('request.jwt.claim.sub')::uuid,
      ''
    );
    raise exception 'FAIL: empty emoji accepted';
  exception
    when check_violation then
      raise notice 'PASS: empty emoji rejected';
  end;

  begin
    update "EventComment" set body = 'edited';
    raise exception 'FAIL: comment update was allowed';
  exception
    when insufficient_privilege then
      raise notice 'PASS: comments are immutable (no UPDATE grant)';
  end;
end $$;

-- Outsider cannot read or write social rows.
set role authenticated;
select set_config(
  'request.jwt.claim.sub',
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  false
);
select set_config(
  'request.jwt.claims',
  '{"sub":"cccccccc-cccc-cccc-cccc-cccccccccccc","email":"c@example.com","user_metadata":{"full_name":"Carol"}}',
  false
);

do $$
begin
  if (select count(*) from "EventReaction") <> 0 then
    raise exception 'FAIL: outsider saw EventReaction rows';
  end if;
  if (select count(*) from "EventComment") <> 0 then
    raise exception 'FAIL: outsider saw EventComment rows';
  end if;
  raise notice 'PASS: social rows hidden from outsiders';

  begin
    insert into "EventReaction" ("eventId", "userId", emoji)
    values (
      current_setting('test.event_a')::uuid,
      current_setting('request.jwt.claim.sub')::uuid,
      '👀'
    );
    raise exception 'FAIL: outsider reacted to an event';
  exception
    when insufficient_privilege then
      raise notice 'PASS: outsider reaction rejected';
  end;
end $$;

-- Owner moderation: A may delete B's reaction.
set role authenticated;
select set_config(
  'request.jwt.claim.sub',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  false
);
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","email":"a@example.com","user_metadata":{"full_name":"Alice"}}',
  false
);

do $$
declare
  v_deleted integer;
begin
  if (select count(*) from "CareTaskCompletion") <> 1 then
    raise exception 'FAIL: owner did not see the completion';
  end if;

  delete from "EventReaction"
  where "eventId" = current_setting('test.event_a')::uuid
    and "userId" = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  get diagnostics v_deleted = row_count;
  if v_deleted <> 1 then
    raise exception 'FAIL: owner could not moderate a reaction';
  end if;
  raise notice 'PASS: owner can moderate a reaction';
end $$;

-- ---------------------------------------------------------------------------
-- RLS + realtime publication
-- ---------------------------------------------------------------------------
reset role;

do $$
declare
  v_missing text;
begin
  select string_agg(t.name, ', ')
  into v_missing
  from (values
    ('CareSchedule'),
    ('CareTaskCompletion'),
    ('EventReaction'),
    ('EventComment')
  ) as t(name)
  where not exists (
    select 1
    from pg_publication_tables p
    where p.pubname = 'supabase_realtime'
      and p.schemaname = 'public'
      and p.tablename = t.name
  );

  if v_missing is not null then
    raise exception 'FAIL: realtime publication missing %', v_missing;
  end if;
  raise notice 'PASS: all four new tables are in supabase_realtime';

  select string_agg(c.relname, ', ')
  into v_missing
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname in (
      'CareSchedule',
      'CareTaskCompletion',
      'EventReaction',
      'EventComment'
    )
    and not c.relrowsecurity;

  if v_missing is not null then
    raise exception 'FAIL: RLS not enabled on %', v_missing;
  end if;
  raise notice 'PASS: RLS enabled on all four new tables';
end $$;

\echo 'All retention RLS checks passed'
