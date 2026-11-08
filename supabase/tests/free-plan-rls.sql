-- Free-plan dog limit and cross-household RLS checks.
-- Run after local-mocks.sql and all migrations, from the repository root:
--   psql ... -f supabase/tests/free-plan-rls.sql

\set ON_ERROR_STOP on

-- User A creates the first household.
set role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '11111111-1111-1111-1111-111111111111',
  false
);
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","email":"a@example.com","user_metadata":{"full_name":"Alice"}}',
  false
);
select id as household_a from public.create_household('A household') \gset
select set_config('test.household_a', :'household_a', false);

-- First dog is allowed on the free plan.
insert into "Dogs" ("dogId", "dogName", "householdId")
values (
  gen_random_uuid(),
  'A first',
  current_setting('test.household_a')::uuid
);

-- Second dog must be blocked by the INSERT policy.
do $$
begin
  insert into "Dogs" ("dogId", "dogName", "householdId")
  values (
    gen_random_uuid(),
    'A second',
    current_setting('test.household_a')::uuid
  );
  raise exception 'FAIL: second free dog was inserted';
exception
  when insufficient_privilege then
    raise notice 'PASS: second free dog blocked by RLS';
end $$;

-- A second user cannot insert into A's household.
set role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '22222222-2222-2222-2222-222222222222',
  false
);
select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-2222-2222-222222222222","email":"b@example.com","user_metadata":{"full_name":"Bob"}}',
  false
);
do $$
begin
  insert into "Dogs" ("dogId", "dogName", "householdId")
  values (
    gen_random_uuid(),
    'Cross household',
    current_setting('test.household_a')::uuid
  );
  raise exception 'FAIL: cross-household dog insert succeeded';
exception
  when insufficient_privilege then
    raise notice 'PASS: cross-household dog insert blocked';
end $$;

-- An active subscription unlocks the second dog.
reset role;
insert into "Subscription" ("householdId", plan, status)
values (current_setting('test.household_a')::uuid, 'monthly', 'active');

set role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '11111111-1111-1111-1111-111111111111',
  false
);
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","email":"a@example.com","user_metadata":{"full_name":"Alice"}}',
  false
);
insert into "Dogs" ("dogId", "dogName", "householdId")
values (
  gen_random_uuid(),
  'A second',
  current_setting('test.household_a')::uuid
);

do $$
begin
  if (
    select count(*)
    from "Dogs"
    where "householdId" = current_setting('test.household_a')::uuid
  ) <> 2 then
    raise exception 'FAIL: expected two dogs after upgrade';
  end if;
  raise notice 'PASS: premium allows a second dog';
end $$;

-- Re-running the limit migration must be safe.
reset role;
\i supabase/migrations/20261108000400_free_plan_limits.sql
\echo 'PASS: migration 4 rerun is idempotent'
