# Loggi database

Versioned Supabase schema, RLS, RPCs, storage policies and realtime setup for
Loggi Release 1.

> **Do not run [`migration.sql`](./migration.sql) in any shared or production
> project.** It is the legacy destructive reset script (`DROP TABLE ... CASCADE`)
> and has been replaced by the migrations in [`migrations/`](./migrations/).
> It is kept only as historical reference and should be removed by the repo
> owner. The only supported ways to apply the schema are the versioned
> migrations below.

The Supabase project was paused and has never held live data. Everything here
was built and tested offline against a throwaway PostgreSQL instance; no remote
database was contacted.

CI repeats the migration/RLS validation on PostgreSQL 16 using the mocks in
[`tests/local-mocks.sql`](./tests/local-mocks.sql) and
[`tests/free-plan-rls.sql`](./tests/free-plan-rls.sql). The mocks are test-only:
they create minimal `auth`/`storage` objects so the real migrations can run on
plain PostgreSQL.

---

## 1. Migration files and apply order

Apply in filename order. The Supabase CLI does this automatically.

| Order | File | What it creates |
| --- | --- | --- |
| 1 | [`migrations/20261108000100_core_schema.sql`](./migrations/20261108000100_core_schema.sql) | `Household`, `HouseholdMember`, `Dogs`, `DogEvent`, `WeightLog`; constraints and indexes; RLS helpers and core RLS policies; initial weight-log backfill |
| 2 | [`migrations/20261108000200_billing_schema.sql`](./migrations/20261108000200_billing_schema.sql) | `BillingCustomer`, `Subscription`, `StripeEvent`; `updatedAt` trigger; `household_is_entitled()`; billing RLS |
| 3 | [`migrations/20261108000300_households.sql`](./migrations/20261108000300_households.sql) | Household RPCs; invite-code generation; `dog-images` bucket and storage policies; realtime publication |
| 4 | [`migrations/20261108000400_free_plan_limits.sql`](./migrations/20261108000400_free_plan_limits.sql) | Free-plan one-dog limit enforced by the `Dogs` INSERT RLS policy |
| 5 | [`migrations/20261109000100_dog_profile.sql`](./migrations/20261109000100_dog_profile.sql) | Optional detailed `Dogs` profile: `breedId`, sex/neuter/DOB, adult weight, size, activity, feeding, medical and training fields |
| 6 | [`migrations/20261109000200_potty_outcomes.sql`](./migrations/20261109000200_potty_outcomes.sql) | Structured `DogEvent` potty outcome/location/cue with toilet-only checks; narrow `isAccident` backfill; potty-summary index |
| 7 | [`migrations/20261109000300_schedules.sql`](./migrations/20261109000300_schedules.sql) | `CareSchedule` and `CareTaskCompletion`; `is_dog_in_household()`/`is_schedule_member()` helpers; RLS and realtime |
| 8 | [`migrations/20261109000400_event_social.sql`](./migrations/20261109000400_event_social.sql) | `EventReaction` and `EventComment`; `is_event_member()`/`is_event_owner()` helpers; immutable-comment RLS and realtime |

The migrations are intended for an **empty schema**. They do not drop tables
and they do not migrate rows from the legacy schema. The paused dev project
should be reset, not upgraded in place.

---

## 2. Fresh dev reset

### Local Supabase stack (recommended)

Requires the Supabase CLI and Docker.

If this checkout does not yet have `supabase/config.toml`, initialise it once and
commit the generated config:

```bash
supabase init
```

Then:

```bash
supabase start
supabase db reset
```

`db reset` recreates the local database, applies every migration in
`supabase/migrations/` in filename order, then runs `supabase/seed.sql` if one
exists.

### Linked dev project

Resume the project in the Supabase dashboard first. Then:

```bash
supabase link --project-ref <dev-project-ref>
supabase db reset --remote
```

If your CLI version predates `--remote`, check `supabase db reset --help`; older
releases use the `--linked` flag instead. The CLI's target/confirmation
behaviour is documented at
<https://supabase.com/docs/guides/local-development/local-and-hosted-projects>.

> **Destructive:** this drops the linked database and recreates it. Only ever
> run it against the dedicated dev project. Never run it against production.

If the CLI is unavailable, the SQL files can be run in order in the dashboard
SQL editor for a dev project. This path is manual, is not idempotent, and should
not be used for production.

---

## 3. Applying to production

1. Take a backup/snapshot first (dashboard backup or `supabase db dump`).
2. Link the production project if it is not already linked.
3. Review what is pending:

   ```bash
   supabase migration list --remote
   ```

4. Apply only the pending migrations:

   ```bash
   supabase db push --remote
   ```

   (Use `--linked` on older CLI releases; check `supabase db push --help`.)

5. Re-run the checks in sections 7–9 against a staging/preview project before
   doing the same in production.

Rules:

- **Never use `supabase db reset` in production.** It destroys all data.
- **Never run `migration.sql`.** It drops every table.
- Migrations are forward-only. Add a new timestamped migration to change
  anything; do not edit a migration that has already been applied.
- The schema is additive and safe for a fresh project, but it assumes the
  legacy tables are not already present.

---

## 4. Schema overview

Quoted CamelCase names are intentional and match the React app.

### Core

- **`Household`** — `id` UUID PK, `name`, `inviteCode` (unique, `^[A-Z0-9]{6}$`),
  `createdBy`, `createdAt`. Name is 1–80 characters.
- **`HouseholdMember`** — `(householdId, userId)` PK, `role` (`owner`/`member`),
  `status` (`active`/`pending`), `joinedAt`, `displayName`. A partial unique
  index enforces **one active household per user** (Release 1).
- **`Dogs`** — `dogId` UUID PK, `dogName`, `householdId` FK, `breed`, `age`
  (0–30), `weight` (> 0 when present), `notes`, `dogImage`.
- **`DogEvent`** — `id` UUID PK, `dogId` FK, `type` (nine values), `subtype`
  (toilet only: `pee`/`poo`/`other`), `isAccident`, `timestamp`, `userId`
  (`DEFAULT auth.uid()`), `note`.
- **`WeightLog`** — `id` UUID PK, `dogId` FK, `weight` (> 0), `recordedAt`,
  `userId` (`DEFAULT auth.uid()`).

All child tables cascade from their parent (`Household` → members/dogs,
`Dogs` → events/weights). There are no `DROP TABLE` statements.

Indexes: `Dogs(householdId)`, `DogEvent(dogId, timestamp DESC)`,
`DogEvent(timestamp)`, `WeightLog(dogId, recordedAt DESC)`,
`HouseholdMember(userId)`, `HouseholdMember(householdId)`, plus the partial
unique active-membership index and the invite-code unique index.

The backfill in migration 1 creates one initial `WeightLog` for any dog that has
a `weight` but no history. It uses `NOT EXISTS`, so it is a no-op on a fresh
reset and safe to reason about. The initial row is attributed to
`Household.createdBy` because a migration connection has no `auth.uid()`.

### Billing

The billing tables match the shared contract in [`../plan.md`](../plan.md):

- **`BillingCustomer`** — `userId` PK, `stripeCustomerId` unique not null,
  `email`, `createdAt`.
- **`Subscription`** — `id` UUID PK, `householdId` FK cascade,
  `stripeSubscriptionId` unique, `stripePriceId`, `plan`
  (`monthly`/`yearly`/`lifetime`), `status` (all Stripe states plus `lifetime`),
  `currentPeriodEnd`, `cancelAtPeriodEnd`, `createdAt`, `updatedAt`.
- **`StripeEvent`** — `id` TEXT PK, `type`, `processedAt`.

A partial unique index prevents more than one `active`/`trialing` subscription
per household. Lifetime rows are deliberately outside that index; the webhook
is responsible for keeping rows consistent.

`household_is_entitled(hid uuid)` returns true when the household has:

- `plan = 'lifetime' AND status = 'lifetime'`, or
- `status IN ('trialing', 'active')`.

---

## 5. RPC API

All functions are in the `public` schema, `SECURITY DEFINER`, with
`SET search_path = public`, and are revoked from `PUBLIC`/`anon`. Only
`authenticated` (and `service_role`) can execute them.

| Signature | Returns | Caller | Behaviour |
| --- | --- | --- | --- |
| `create_household(p_name text)` | `"Household"` | authenticated | Rejects an existing active membership; generates a secure unique 6-character code server-side; inserts the household and the owner membership atomically |
| `join_household(p_code text)` | `"Household"` | authenticated | Uppercases the code; rejects an existing active membership; inserts an active `member` with `displayName` from auth metadata; never accepts role/status |
| `leave_household()` | `void` | active member | Removes the caller's membership. Owners are rejected in Release 1; support must transfer/delete the household |
| `remove_household_member(p_user_id uuid)` | `void` | owner | Removes another member of the caller's household; cannot remove self |
| `rename_household(p_name text)` | `"Household"` | owner | Renames the caller's household; returns the updated row |
| `regenerate_invite_code()` | `text` | owner | Rotates the invite code and returns the new 6-character code |
| `update_my_display_name(p_name text)` | `void` | active member | Updates the caller's own `displayName` |
| `household_is_entitled(hid uuid)` | `boolean` | authenticated | Read-only entitlement check; granted to authenticated and service role |
| `is_household_member(hid uuid)`, `is_household_owner(hid uuid)`, `is_dog_member(did uuid)`, `is_dog_owner(did uuid)`, `is_household_member_text(hid text)` | `boolean` | authenticated | RLS helpers. They return only a boolean and reveal no rows |
| `generate_invite_code()`, `default_display_name()`, `set_updated_at()` | internal | not granted | Implementation details; trigger/internal use only |

### Client calls

```ts
const { data: household, error } = await supabase.rpc("create_household", {
  p_name: name.trim(),
});

const { data: household, error } = await supabase.rpc("join_household", {
  p_code: code,
});

const { data: renamed, error } = await supabase.rpc("rename_household", {
  p_name: name.trim(),
});

const { data: newCode, error } = await supabase.rpc("regenerate_invite_code");
```

### Error codes

| SQLSTATE | Meaning |
| --- | --- |
| `42501` | Not authenticated; owner-only action; owner attempted to leave |
| `23505` | Caller already has an active household; invite-code generation collision |
| `22023` | Blank/too-long name; invalid invite-code shape; removing self |
| `P0002` | Invite code not found; caller not in an active household; target member not found |

The app should surface the message (or map SQLSTATEs) rather than silently
retrying. `create_household` and `join_household` are atomic; a failed membership
insert rolls the whole call back.

---

## 6. Security model

### RLS helpers instead of recursive policies

Policies do not query `HouseholdMember` or `Dogs` directly. They call
`SECURITY DEFINER` helpers owned by the migration role (the table owner), which
bypass RLS for the duration of the check and pin `search_path = public`.
Examples:

```sql
using (public.is_household_member("householdId"))
using (public.is_dog_member("dogId"))
using (public.is_household_owner(id))
```

This avoids infinite RLS recursion and keeps the policy expressions small.

### Household and membership writes are RPC-only

- `Household`: members may `SELECT`; owners may `UPDATE`. Authenticated clients
  have `UPDATE` only on the `name` column, so `createdBy` and `inviteCode`
  cannot be rewritten directly. There is no `INSERT`/`DELETE` grant or policy.
- `HouseholdMember`: active members may `SELECT` members of their own
  household. There is no client `INSERT`/`UPDATE`/`DELETE` grant or policy.
- `create_household`, `join_household`, `leave_household`,
  `remove_household_member`, `rename_household` and
  `regenerate_invite_code` run as the function owner and perform the writes.

This is what prevents a client from inserting itself as `owner` or editing
another member's role.

### Core table rules

| Table | SELECT | INSERT | UPDATE | DELETE |
| --- | --- | --- | --- | --- |
| `Household` | members | RPC only | owner (`name` only) | support/service role only (no client delete) |
| `HouseholdMember` | same-household members | RPC only | RPC only | RPC only |
| `Dogs` | members | members | members | owner |
| `DogEvent` | members | members, `userId = auth.uid()` | author or owner | author or owner |
| `WeightLog` | members | members, `userId = auth.uid()` | author or owner | author or owner |

`DogEvent.userId` and `WeightLog.userId` default to `auth.uid()`, and their
insert policies require it. A member cannot forge another user's author
attribution.

Note that a `DELETE`/`UPDATE` that matches zero rows under RLS returns no error
and reports zero affected rows. The app must gate destructive controls by role
and author, or check the returned rows; otherwise it can optimistically update
local state when the database rejected the change silently.

### Storage

- Bucket `dog-images` exists and is public.
- Object paths are `<householdId>/<file>`.
- Public `SELECT` is intentional for dog photos.
- `INSERT`/`UPDATE`/`DELETE` are limited to authenticated users whose active
  household matches the first path segment.
- The membership check compares the path segment as **text**
  (`is_household_member_text`), so a malformed path returns false instead of
  raising an invalid-UUID cast error.
- The legacy `"Public Access"` policy (any role, any operation) is dropped if
  present. It is not recreated.

Public read means anyone with an object URL can fetch a dog photo. Do not put
private documents in this bucket.

### Billing

- RLS is enabled on `BillingCustomer`, `Subscription` and `StripeEvent`.
- Only `Subscription` has a client policy: active household members may
  `SELECT` their household's rows.
- `BillingCustomer` and `StripeEvent` have no policies and no client grants.
- Clients have no `INSERT`/`UPDATE`/`DELETE` grants on any billing table.
- Edge Functions use the service role, which bypasses RLS.
- Never ship a service-role key to the browser.

### Invite codes

`generate_invite_code()` draws 6 characters from
`ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (32 unambiguous characters) using bytes from
`gen_random_uuid()` (a strong random source on PostgreSQL 13+). 32 divides 256,
so there is no modulo bias. The database check accepts any
`^[A-Z0-9]{6}$` for compatibility, but generated codes never contain `I`, `O`,
`0` or `1`.

### Account deletion / `auth.users`

There are intentionally **no foreign keys from these tables to `auth.users`**.
This keeps the schema portable and avoids surprising cascades when an auth user
is deleted. Account deletion (Release 1 legal flow) must explicitly remove or
transfer the user's household memberships, events and weight logs, or a future
migration should add the appropriate FKs. This is a known follow-up risk.

### Owner transfer

Release 1 has no ownership-transfer RPC. `leave_household()` rejects every
owner, even if another owner somehow exists. Ownership transfer or household
deletion is a support action using the service role.

---

## 7. Testing RLS with two users

### Create two test users

Use **Authentication → Users → Add user** in the dashboard, or sign up twice in
the app, and copy both UUIDs from the Users table. For API/JWT tests these must
be real users.

For a pure SQL policy test, any two UUIDs work because the schema has no FK to
`auth.users`. That is useful for CI/negative tests but does not exercise JWT
issuance.

### Paste-and-run two-user script

Run this in the dashboard SQL editor (or as `postgres` in `psql`). It creates a
temporary context, switches between two authenticated identities with
`request.jwt.claims`, exercises the main rules, and rolls everything back.

Replace the two `sub` UUIDs with real user IDs if you want the display names to
look realistic. The script runs as a transaction; `rollback` leaves no data.

```sql
begin;

create temp table rls_ctx (hid uuid, code text, did uuid) on commit drop;
grant select, insert, update on rls_ctx to authenticated;

-- User A creates the household and a dog.
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","email":"alice@example.com","user_metadata":{"display_name":"Alice"}}',
  true);

insert into rls_ctx (hid, code)
select id, "inviteCode" from public.create_household('RLS test household');

with ins as (
  insert into "Dogs" ("dogName", "householdId", weight)
  select 'Test dog', hid, 10 from rls_ctx
  returning "dogId"
)
update rls_ctx set did = ins."dogId" from ins;

select count(*) as a_households from "Household";   -- 1
select count(*) as a_dogs from "Dogs";              -- 1

-- User B cannot see the household before joining.
reset role;
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated","email":"bob@example.com","user_metadata":{"display_name":"Bob"}}',
  true);

select count(*) as b_households_before from "Household";  -- 0
select count(*) as b_dogs_before from "Dogs";             -- 0

select id, "inviteCode" from public.join_household((select code from rls_ctx));

select count(*) as b_households_after from "Household";   -- 1
select count(*) as b_dogs_after from "Dogs";              -- 1
select "displayName" from "HouseholdMember"
where "userId" = auth.uid();                              -- Bob

-- Member cannot rename. The function raises 42501.
do $$
begin
  perform public.rename_household('Hacked');
  raise exception 'expected failure: member renamed the household';
exception
  when insufficient_privilege then
    raise notice 'PASS: member cannot rename the household';
end $$;

-- Member cannot forge another author. RLS raises 42501.
do $$
begin
  insert into "DogEvent" ("dogId", type, "userId")
  values ((select did from rls_ctx), 'feed',
          '11111111-1111-4111-8111-111111111111');
  raise exception 'expected failure: member spoofed another author';
exception
  when insufficient_privilege then
    raise notice 'PASS: member cannot spoof an event author';
end $$;

rollback;
```

Expected: A sees 1/1, B sees 0/0 before joining and 1/1 after, the two DO blocks
print PASS notices, and the transaction rolls back.

### Negative checks to run manually

Run these as the relevant user in separate transactions (an expected error
aborts the transaction otherwise):

```sql
-- As non-member B:
select count(*) from "Household";                       -- 0
select count(*) from "Dogs";                            -- 0
insert into "Household" (name, "inviteCode", "createdBy")
values ('Forged', 'ABCDEF', auth.uid());                -- permission denied
insert into "HouseholdMember" ("householdId", "userId", role, status)
values ('<household-id>', auth.uid(), 'owner', 'active'); -- permission denied
```

```sql
-- As owner A: owner cannot leave in Release 1 (42501).
select public.leave_household();

-- As owner A: cannot remove self (22023).
select public.remove_household_member(auth.uid());
```

```sql
-- Constraint checks (as any member; use a dog/household you own):
insert into "Dogs" ("dogName", "householdId", age)
values ('Too old', '<household-id>', 31);               -- Dogs_age_range
insert into "Dogs" ("dogName", "householdId", weight)
values ('Zero', '<household-id>', 0);                   -- Dogs_weight_positive
insert into "DogEvent" ("dogId", type)
values ('<dog-id>', 'bath');                            -- DogEvent_type_check
insert into "DogEvent" ("dogId", type, subtype)
values ('<dog-id>', 'feed', 'pee');                     -- DogEvent_subtype_check
```

### Inspect policies and grants

```sql
-- All policies for the app tables.
select schemaname, tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

-- Storage policies.
select policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'storage' and tablename = 'objects'
order by policyname;

-- Confirm clients cannot write the RPC-only tables.
select has_table_privilege('authenticated', '"Household"', 'INSERT') as household_insert,
       has_table_privilege('authenticated', '"HouseholdMember"', 'INSERT') as member_insert,
       has_column_privilege('authenticated', '"Household"', 'name', 'UPDATE') as can_rename,
       has_column_privilege('authenticated', '"Household"', 'createdBy', 'UPDATE') as can_change_creator;
```

---

## 8. Verifying storage

### Bucket and policies

```sql
select id, name, public from storage.buckets where id = 'dog-images';
-- expected: dog-images | dog-images | true

select policyname, cmd, roles
from pg_policies
where schemaname = 'storage' and tablename = 'objects'
order by policyname;
```

Expected policies:

- `dog_images_public_read` (`SELECT`, public)
- `dog_images_insert_household_members` (`INSERT`, authenticated)
- `dog_images_update_household_members` (`UPDATE`, authenticated)
- `dog_images_delete_household_members` (`DELETE`, authenticated)

### API check

As an authenticated member of household `<household-id>`:

```ts
const file = new File(["test"], "rls-test.txt", { type: "text/plain" });

const { error } = await supabase.storage
  .from("dog-images")
  .upload(`${householdId}/rls-test.txt`, file);
```

Expected: success. Then:

1. Upload under a random household UUID path: expected RLS error.
2. As a user who is not a member of that household: upload expected RLS error.
3. Fetch the object's public URL in a private/incognito window: expected to
   load, because the bucket is public by design.
4. As a member, rename the object within the same household path: success.
5. Attempt to rename it into another household's path: expected RLS error.

The browser app already uses the correct path convention
(`${householdId}/${crypto.randomUUID()}`). Do not change it to a flat filename or
to a user-id-based path; storage policies depend on the first segment.

---

## 9. Verifying realtime

```sql
select schemaname, tablename
from pg_publication_tables
where pubname = 'supabase_realtime'
order by tablename;
-- expected: public | DogEvent
--           public | WeightLog
```

Client subscription (the exact channel name is up to the app):

```ts
const channel = supabase
  .channel("household-events")
  .on(
    "postgres_changes",
    { event: "*", schema: "public", table: "DogEvent" },
    (payload) => {
      // refetch or merge the event
    },
  )
  .on(
    "postgres_changes",
    { event: "*", schema: "public", table: "WeightLog" },
    (payload) => {
      // refetch or merge the weight
    },
  )
  .subscribe();
```

Supabase Realtime applies RLS to Postgres Changes, so only active members of the
household should receive the rows. Test with two browser profiles: member A
logs a feed event, member B sees it without refreshing. A non-member should see
nothing even if they subscribe to the table.

`DogEvent`, `WeightLog`, `CareSchedule`, `CareTaskCompletion`, `EventReaction`
and `EventComment` are in the publication. If you add another realtime table
later, add it in a new migration with the same idempotent
`pg_publication_tables` check.

---

## 10. Verifying billing / entitlement

Webhooks and Edge Functions use the service role. To test the schema and RLS
from SQL, run the inserts as `postgres` (or the service role) and the reads as
an authenticated user.

```sql
-- Service role / SQL editor only:
insert into "Subscription" ("householdId", plan, status, "stripeSubscriptionId")
values ('<household-id>', 'monthly', 'active', 'sub_test_123');

select public.household_is_entitled('<household-id>');  -- true
```

```sql
-- As an active member:
select * from "Subscription";                           -- rows for the household
select public.household_is_entitled('<household-id>');  -- true

-- As a non-member:
select count(*) from "Subscription";                    -- 0
```

Expected failures:

- Authenticated client attempts `insert`, `update` or `delete` on
  `Subscription`: permission denied.
- Authenticated client attempts to read `BillingCustomer` or `StripeEvent`:
  permission denied.
- A second `active`/`trialing` subscription for the same household:
  `Subscription_one_live_per_household_idx` unique violation.

The `updatedAt` trigger fires on every `UPDATE` of `Subscription`:

```sql
update "Subscription" set status = 'past_due' where id = '<subscription-id>';
select "updatedAt" from "Subscription" where id = '<subscription-id>';
```

Entitlement semantics:

- `plan='lifetime' AND status='lifetime'` → entitled.
- `status IN ('trialing','active')` → entitled.
- `past_due`, `canceled`, `unpaid`, `incomplete`, etc. → not entitled until the
  webhook updates them.
- Lifetime rows are not part of the one-live-subscription unique index; the
  webhook must keep lifetime/Stripe rows consistent.

For the full Stripe setup and webhook testing, see
[`../docs/stripe-setup.md`](../docs/stripe-setup.md) (owned by Agent B).

---

## 11. Troubleshooting

- **`permission denied for table ...` after adding a new RPC/table:** check the
  explicit `REVOKE`/`GRANT` block in the migration. Supabase's default
  privileges can grant more than intended.
- **A function is missing from the API:** check `EXECUTE` grants and wait for
  PostgREST's schema cache to reload. `NOTIFY pgrst, 'reload schema';` can be
  used after manual SQL-editor changes.
- **RLS recursion / stack depth:** do not query `HouseholdMember` or `Dogs`
  directly in a policy; use the SECURITY DEFINER helpers.
- **Storage writes fail with a UUID cast error:** the policy must compare the
  path segment as text via `is_household_member_text`, not `::uuid`.
- **Realtime events missing:** confirm both tables are in
  `pg_publication_tables` and that the subscriber is an active member (RLS
  filters Postgres Changes).
- **Owner cannot leave:** intentional in Release 1. Transfer/delete is a
  support action.
- **Invite code rejected:** codes are 6 uppercase letters/digits; the RPC
  uppercases input, but malformed lengths are rejected with `22023`.
- **Weight 0 rejected:** `Dogs.weight` and `WeightLog.weight` require `> 0`.
  Validate this in the form before submitting.

---

## 12. Assumptions and known risks

1. **No FK to `auth.users`.** Account deletion must clean up memberships,
   events and weights explicitly. Consider adding FKs in a later migration once
   the account-deletion flow is defined.
2. **One active household per user.** Multi-household switching is Release 2.
   The partial unique index makes this a hard database rule.
3. **Owners cannot leave or transfer ownership.** Support must transfer/delete.
4. **`HouseholdMember.status='pending'` is retained for schema compatibility**
   but the Release 1 RPCs only create `active` rows. Any future invitation flow
   must not grant access to pending rows and must respect the partial unique
   index.
5. **Subtypes are coupled to `toilet`.** If another event type gains subtypes,
   the `DogEvent_subtype_check` constraint must be extended in a new migration.
6. **`household_is_entitled` is callable by any authenticated user for a known
   household UUID.** It returns only a boolean. UUIDs are unguessable, but if
   this is considered too much information, wrap the client-facing call in a
   membership check and keep a separate service-role helper for the webhook.
7. **Lifetime rows are not in the active-subscription unique index.** The
   webhook must cancel/clear stale Stripe rows when a lifetime purchase is
   recorded.
8. **The storage bucket is public.** Dog photos are readable by anyone with the
   URL. Do not store private documents there.
9. **The legacy `migration.sql` still exists in this directory.** It is
   destructive and must not be run. It should be removed by the repo owner.
10. **No remote application was performed.** The Supabase project is paused; this
    schema was validated offline against PostgreSQL 18 with mocked `auth` and
    `storage` schemas.

---

## 13. Frontend contract changes

These are the changes the React app must make to work with this schema. (The
current `release/mvp` working tree already contains most of the RPC/type
changes; this list is the contract for any remaining screens and for review.)

1. **Stop inserting `Household`/`HouseholdMember` directly.**
   `HouseholdSetupScreen` must call:

   ```ts
   const { data, error } = await supabase.rpc("create_household", {
     p_name: householdName.trim(),
   });
   ```

   and:

   ```ts
   const { data, error } = await supabase.rpc("join_household", {
     p_code: inviteCode,
   });
   ```

   The old client-side `generateUniqueInviteCode` helper and the direct
   `select ... from Household where inviteCode = ...` lookup are obsolete; RLS
   hides invite-code lookup from non-members.

2. **`HouseholdMember` now has `displayName`.** Add it to
   `src/types/core.ts` (optional/string) and use it for “Logged by …”. The RPC
   captures it from `user_metadata.display_name`, then `full_name`, then `name`,
   then the email local part, then `"Member"`. Sign-up can set
   `options.data.display_name` explicitly; otherwise the fallback is used.

3. **`WeightLog` now has `userId`.** Add it to `src/types/core.ts` if the UI
   displays the logger. The database default fills it for existing inserts, so
   `DogProfileScreen` does not need to send it.

4. **Owner-only controls must be gated in the UI.** Deleting a dog, renaming,
   regenerating the invite code, removing members and billing checkout/portal
   are owner-only. `UPDATE`/`DELETE` that match zero rows under RLS return no
   error, so an optimistic state update after a denied delete will diverge.
   Select `role`/`displayName` for the current membership and hide/disable
   controls, or check that the mutation returned a row.

5. **Event deletion is author-or-owner.** `App.tsx` currently shows the delete
   control on every event; hide it for events where the user is neither the
   author nor a household owner.

6. **Validation:** household name and display name are 1–80 characters after
   trimming; dog weight and weight-log weight must be `> 0`; dog age is
   `0..30`; dog name must be non-blank after trimming. The registration form
   currently allows `min="0"` for weight and will now get a database error for
   zero.

7. **Storage paths are unchanged:** continue uploading to
   `${householdId}/${crypto.randomUUID()}`. Public read URLs work as before.

8. **Realtime:** subscribe to `DogEvent` and `WeightLog` and refetch on
   reconnect/focus. Realtime is filtered by RLS, so only household members
   receive events.

9. **Household settings UI:** add flows for member list, leave (members only),
   remove (owners only), rename (owners only), copy invite code, regenerate
   (owners only), and optional `update_my_display_name`. There is no
   ownership-transfer RPC in Release 1.

10. **Billing:** use the shared billing types and Agent B's Edge Functions.
    `household_is_entitled(householdId)` is the read-only entitlement check. Do
    not attempt client-side billing writes.
