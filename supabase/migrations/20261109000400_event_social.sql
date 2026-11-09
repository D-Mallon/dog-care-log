-- ============================================================================
-- Event reactions and short comments
-- ----------------------------------------------------------------------------
-- Lightweight, event-anchored social features: one emoji reaction per
-- (event, user, emoji) and immutable short comments. This is deliberately not
-- a chat system: comments have a hard 500-character limit and no update path.
--
-- Visibility is anchored to the event's dog household, not to a client-supplied
-- household id, via the SECURITY DEFINER is_event_member() helper.
-- ============================================================================

create table if not exists "EventReaction" (
  "eventId" uuid not null references "DogEvent"(id) on delete cascade,
  "userId" uuid not null,
  emoji text not null,
  "createdAt" timestamptz not null default now(),

  primary key ("eventId", "userId", emoji),
  constraint "EventReaction_emoji_length_check"
    check (char_length(emoji) between 1 and 16)
);

comment on table "EventReaction" is
  'One emoji reaction per event/user/emoji. Users can remove their own reaction; household owners can moderate.';

create table if not exists "EventComment" (
  id uuid primary key default gen_random_uuid(),
  "eventId" uuid not null references "DogEvent"(id) on delete cascade,
  "userId" uuid not null,
  body text not null,
  "createdAt" timestamptz not null default now(),

  constraint "EventComment_body_length_check"
    check (char_length(body) between 1 and 500)
);

comment on table "EventComment" is
  'Immutable short event comments (1..500 characters). No UPDATE policy or grant exists.';

create index if not exists "EventReaction_eventId_idx"
  on "EventReaction" ("eventId");

create index if not exists "EventComment_eventId_createdAt_idx"
  on "EventComment" ("eventId", "createdAt");

-- ============================================================================
-- SECURITY DEFINER helpers
-- ----------------------------------------------------------------------------
-- The event's household is derived server-side from DogEvent -> Dogs. These
-- helpers return only a boolean for auth.uid(); they bypass RLS on the tables
-- they read so a policy never recursively evaluates its own table.
-- ============================================================================

create or replace function public.is_event_member(event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from "DogEvent" e
    join "Dogs" d on d."dogId" = e."dogId"
    where e.id = event_id
      and public.is_household_member(d."householdId")
  );
$$;

comment on function public.is_event_member(uuid) is
  'True when auth.uid() is an active member of the household that owns the event dog.';

create or replace function public.is_event_owner(event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from "DogEvent" e
    join "Dogs" d on d."dogId" = e."dogId"
    where e.id = event_id
      and public.is_household_owner(d."householdId")
  );
$$;

comment on function public.is_event_owner(uuid) is
  'True when auth.uid() is an active owner of the household that owns the event dog.';

revoke all on function public.is_event_member(uuid)
  from public, anon, authenticated;
revoke all on function public.is_event_owner(uuid)
  from public, anon, authenticated;

grant execute on function public.is_event_member(uuid)
  to authenticated, service_role;
grant execute on function public.is_event_owner(uuid)
  to authenticated, service_role;

-- ============================================================================
-- Row Level Security
-- ============================================================================

alter table "EventReaction" enable row level security;
alter table "EventComment" enable row level security;

-- ---------------------------------------------------------------------------
-- EventReaction
-- ---------------------------------------------------------------------------
-- Members read reactions on their events. Inserts are pinned to the caller
-- and to an event they can see. Deletes are allowed for the reaction author or
-- a household owner (moderation). There is intentionally no UPDATE grant or
-- policy.
drop policy if exists "event_reaction_select_members" on "EventReaction";
create policy "event_reaction_select_members"
  on "EventReaction"
  for select
  to authenticated
  using (public.is_event_member("eventId"));

drop policy if exists "event_reaction_insert_members" on "EventReaction";
create policy "event_reaction_insert_members"
  on "EventReaction"
  for insert
  to authenticated
  with check (
    "userId" = auth.uid()
    and public.is_event_member("eventId")
  );

drop policy if exists "event_reaction_delete_author_or_owner" on "EventReaction";
create policy "event_reaction_delete_author_or_owner"
  on "EventReaction"
  for delete
  to authenticated
  using (
    public.is_event_member("eventId")
    and ("userId" = auth.uid() or public.is_event_owner("eventId"))
  );

-- ---------------------------------------------------------------------------
-- EventComment
-- ---------------------------------------------------------------------------
-- Comments are immutable: no UPDATE policy and no UPDATE privilege. Members
-- read and post on their events; the author or a household owner can delete.
drop policy if exists "event_comment_select_members" on "EventComment";
create policy "event_comment_select_members"
  on "EventComment"
  for select
  to authenticated
  using (public.is_event_member("eventId"));

drop policy if exists "event_comment_insert_members" on "EventComment";
create policy "event_comment_insert_members"
  on "EventComment"
  for insert
  to authenticated
  with check (
    "userId" = auth.uid()
    and public.is_event_member("eventId")
  );

drop policy if exists "event_comment_delete_author_or_owner" on "EventComment";
create policy "event_comment_delete_author_or_owner"
  on "EventComment"
  for delete
  to authenticated
  using (
    public.is_event_member("eventId")
    and ("userId" = auth.uid() or public.is_event_owner("eventId"))
  );

-- ============================================================================
-- Privileges
-- ============================================================================

revoke all on "EventReaction" from anon, authenticated;
grant select, insert, delete on "EventReaction" to authenticated;
grant all on "EventReaction" to service_role;

revoke all on "EventComment" from anon, authenticated;
grant select, insert, delete on "EventComment" to authenticated;
grant all on "EventComment" to service_role;

-- ============================================================================
-- Realtime publication
-- ============================================================================
-- Idempotent, mirroring 20261108000300_households.sql. Realtime applies RLS,
-- so only active household members receive these rows.
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
      and tablename = 'EventReaction'
  ) then
    execute 'alter publication supabase_realtime add table "EventReaction"';
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'EventComment'
  ) then
    execute 'alter publication supabase_realtime add table "EventComment"';
  end if;
end
$$;
