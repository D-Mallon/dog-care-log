-- ============================================================================
-- Structured potty outcomes
-- ----------------------------------------------------------------------------
-- Adds success/accident, location and cue to "DogEvent". The three fields are
-- optional, but when set they only make sense on a toilet event; the
-- `_type_check` constraints below reject them on feed/walk/etc.
--
-- Backfill is deliberately narrow: only legacy toilet events that were already
-- flagged `isAccident = true` become `pottyOutcome = 'accident'`. Every other
-- legacy toilet event stays null/unclassified rather than being guessed.
--
-- The composite index supports potty summaries (success rate, intervals,
-- location/cue breakdown) filtered by dog and event type.
-- ============================================================================

alter table "DogEvent"
  add column if not exists "pottyOutcome" text
    constraint "DogEvent_pottyOutcome_check"
    check ("pottyOutcome" is null or "pottyOutcome" in ('success', 'accident'))
    constraint "DogEvent_pottyOutcome_type_check"
    check ("pottyOutcome" is null or type = 'toilet'),
  add column if not exists "pottyLocation" text
    constraint "DogEvent_pottyLocation_check"
    check (
      "pottyLocation" is null
      or "pottyLocation" in ('outside', 'pad', 'indoor', 'crate', 'garden', 'other')
    )
    constraint "DogEvent_pottyLocation_type_check"
    check ("pottyLocation" is null or type = 'toilet'),
  add column if not exists "pottyCue" text
    constraint "DogEvent_pottyCue_check"
    check ("pottyCue" is null or "pottyCue" in ('asked', 'unprompted', 'none'))
    constraint "DogEvent_pottyCue_type_check"
    check ("pottyCue" is null or type = 'toilet');

-- Narrow backfill from the old boolean. Guarded by `is null` so a future
-- re-run can never overwrite an explicit success/accident value.
update "DogEvent"
set "pottyOutcome" = 'accident'
where type = 'toilet'
  and "isAccident" = true
  and "pottyOutcome" is null;

comment on column "DogEvent"."pottyOutcome" is
  'Structured toilet result. Null means unclassified (including most legacy events).';
comment on column "DogEvent"."pottyLocation" is
  'Where a toilet event happened. Only valid on type = toilet.';
comment on column "DogEvent"."pottyCue" is
  'Whether the dog asked, went unprompted or had no cue. Only valid on type = toilet.';

create index if not exists "DogEvent_dogId_type_timestamp_idx"
  on "DogEvent" ("dogId", type, "timestamp" desc);

comment on index "DogEvent_dogId_type_timestamp_idx" is
  'Supports per-dog potty summaries and other type-filtered event queries.';
