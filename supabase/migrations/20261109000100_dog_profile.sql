-- ============================================================================
-- Loggi detailed dog profile
-- ----------------------------------------------------------------------------
-- Adds optional identity and care fields to "Dogs". Every new column is
-- nullable so existing dogs, and clients that only know the original
-- name/breed/age/weight fields, keep working unchanged.
--
-- The legacy `breed`, `age`, `weight` and `notes` columns are intentionally
-- kept. `breedId` is a stable catalogue id; `breed` remains the free-text
-- fallback for mixed breeds and "I can't find it" entries.
--
-- Written to be safe to re-apply: each ADD COLUMN uses IF NOT EXISTS and the
-- validation constraints are declared inline with explicit names.
-- ============================================================================

alter table "Dogs"
  -- Identity / appearance
  add column if not exists "breedId" text,
  add column if not exists sex text default 'unknown'
    constraint "Dogs_sex_check"
    check (sex is null or sex in ('male', 'female', 'unknown')),
  add column if not exists neutered boolean,
  add column if not exists "dateOfBirth" date,
  add column if not exists "adultWeightKg" numeric
    constraint "Dogs_adultWeightKg_positive"
    check ("adultWeightKg" is null or "adultWeightKg" > 0),
  add column if not exists "sizeCategory" text
    constraint "Dogs_sizeCategory_check"
    check (
      "sizeCategory" is null
      or "sizeCategory" in ('toy', 'small', 'medium', 'large', 'giant', 'unknown')
    ),
  add column if not exists "coatType" text,

  -- Care profile
  add column if not exists "activityLevel" text
    constraint "Dogs_activityLevel_check"
    check (
      "activityLevel" is null
      or "activityLevel" in ('low', 'moderate', 'high', 'very_high')
    ),
  add column if not exists "foodType" text,
  add column if not exists "feedingSchedule" text,
  add column if not exists allergies text,
  add column if not exists medications text,
  add column if not exists "medicalNotes" text,
  add column if not exists "temperamentNotes" text,
  add column if not exists "trainingStage" text
    constraint "Dogs_trainingStage_check"
    check (
      "trainingStage" is null
      or "trainingStage" in ('puppy', 'adolescent', 'adult', 'senior', 'unknown')
    );

comment on column "Dogs"."breedId" is
  'Stable id from the local breed catalogue; breed remains the free-text fallback.';
comment on column "Dogs".sex is
  'Biological sex as entered by the owner. Defaults to unknown; nullable for legacy rows.';
comment on column "Dogs"."dateOfBirth" is
  'Exact birth date, preferred over the legacy integer age when present.';
comment on column "Dogs"."adultWeightKg" is
  'Expected adult weight in kilograms. Must be positive when present.';
comment on column "Dogs"."feedingSchedule" is
  'Owner-entered free text describing meal times/amounts; not a CareSchedule row.';
