-- ============================================================================
-- Release 1 free-plan limit: one dog per unentitled household
-- ----------------------------------------------------------------------------
-- Premium households can add unlimited dogs. A household with no active
-- subscription/trial/lifetime purchase may add a dog only while it has none.
-- Existing households with multiple dogs keep their data; the rule only gates
-- new inserts.
--
-- This is enforced in RLS rather than only in the React UI, so a direct client
-- insert cannot bypass the paywall.
-- ============================================================================

create or replace function public.household_can_add_dog(hid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.household_is_entitled(hid)
    or (
      select count(*) = 0
      from "Dogs" d
      where d."householdId" = hid
    );
$$;

comment on function public.household_can_add_dog(uuid) is
  'True when the household is entitled or has no dogs yet. Enforces the Release 1 free-plan one-dog limit.';

revoke all on function public.household_can_add_dog(uuid)
  from public, anon, authenticated;
grant execute on function public.household_can_add_dog(uuid)
  to authenticated, service_role;

-- Replace the broad member-insert policy from the core schema with one that
-- also checks the plan limit. Updates/deletes/selects are unchanged.
drop policy if exists "dogs_insert_members" on "Dogs";
create policy "dogs_insert_members"
  on "Dogs"
  for insert
  to authenticated
  with check (
    public.is_household_member("householdId")
    and public.household_can_add_dog("householdId")
  );

comment on policy "dogs_insert_members" on "Dogs" is
  'Household members can add a dog when the household is entitled or has no dogs yet.';
