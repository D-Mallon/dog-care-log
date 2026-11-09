-- ============================================================================
-- LEGACY DESTRUCTIVE SCRIPT — DO NOT RUN.
-- This file predates the versioned migrations and drops every table. It is kept
-- only for historical reference. Use supabase/migrations/ and supabase/README.md.
-- ============================================================================

-- ============================================================
-- Loggi - Full Database Migration
-- Run this in your Supabase SQL editor (Dashboard > SQL Editor)
-- WARNING: This drops ALL existing tables. Safe if no test users.
-- ============================================================

-- Drop existing tables
DROP TABLE IF EXISTS "WeightLog" CASCADE;
DROP TABLE IF EXISTS "DogEvent" CASCADE;
DROP TABLE IF EXISTS "Dogs" CASCADE;
DROP TABLE IF EXISTS "HouseholdMember" CASCADE;
DROP TABLE IF EXISTS "Household" CASCADE;

-- ============================================================
-- TABLES
-- ============================================================

-- Households
CREATE TABLE "Household" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  "inviteCode" TEXT NOT NULL UNIQUE,
  "createdBy" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ DEFAULT now()
);

-- Household members (join table)
CREATE TABLE "HouseholdMember" (
  "householdId" UUID NOT NULL REFERENCES "Household"(id) ON DELETE CASCADE,
  "userId" UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('active', 'pending')),
  "joinedAt" TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY ("householdId", "userId")
);

-- Dogs (now includes breed column)
CREATE TABLE "Dogs" (
  "dogId" UUID PRIMARY KEY,
  "dogName" TEXT NOT NULL,
  "householdId" UUID NOT NULL REFERENCES "Household"(id) ON DELETE CASCADE,
  breed TEXT,
  age INTEGER,
  weight NUMERIC,
  notes TEXT,
  "dogImage" TEXT NOT NULL DEFAULT ''
);

-- Dog events (feed, walk, toilet, meds, sick, nap, play, water, grooming)
CREATE TABLE "DogEvent" (
  id UUID PRIMARY KEY,
  "dogId" UUID NOT NULL REFERENCES "Dogs"("dogId") ON DELETE CASCADE,
  type TEXT NOT NULL,
  subtype TEXT,
  "isAccident" BOOLEAN DEFAULT false,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  "userId" UUID NOT NULL,
  note TEXT
);

-- Weight tracking
CREATE TABLE "WeightLog" (
  id UUID PRIMARY KEY,
  "dogId" UUID NOT NULL REFERENCES "Dogs"("dogId") ON DELETE CASCADE,
  weight NUMERIC NOT NULL,
  "recordedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE "Household" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "HouseholdMember" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Dogs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DogEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WeightLog" ENABLE ROW LEVEL SECURITY;

-- Household: authenticated users can create, members can view
CREATE POLICY "Users can create households" ON "Household"
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Members can view their household" ON "Household"
  FOR SELECT USING (
    id IN (
      SELECT "householdId" FROM "HouseholdMember"
      WHERE "userId" = auth.uid()
    )
  );

-- HouseholdMember: users manage their own memberships
CREATE POLICY "Users can insert their own membership" ON "HouseholdMember"
  FOR INSERT WITH CHECK ("userId" = auth.uid());

CREATE POLICY "Users can view their own memberships" ON "HouseholdMember"
  FOR SELECT USING ("userId" = auth.uid());

-- Dogs: household members can manage their dogs
CREATE POLICY "Members can manage dogs in their household" ON "Dogs"
  FOR ALL USING (
    "householdId" IN (
      SELECT "householdId" FROM "HouseholdMember"
      WHERE "userId" = auth.uid() AND status = 'active'
    )
  );

-- DogEvent: household members can manage events for their dogs
CREATE POLICY "Members can manage events for their dogs" ON "DogEvent"
  FOR ALL USING (
    "dogId" IN (
      SELECT "dogId" FROM "Dogs"
      WHERE "householdId" IN (
        SELECT "householdId" FROM "HouseholdMember"
        WHERE "userId" = auth.uid() AND status = 'active'
      )
    )
  );

-- WeightLog: household members can manage weight logs for their dogs
CREATE POLICY "Members can manage weight logs for their dogs" ON "WeightLog"
  FOR ALL USING (
    "dogId" IN (
      SELECT "dogId" FROM "Dogs"
      WHERE "householdId" IN (
        SELECT "householdId" FROM "HouseholdMember"
        WHERE "userId" = auth.uid() AND status = 'active'
      )
    )
  );

-- ============================================================
-- STORAGE
-- ============================================================

-- Create storage bucket for dog images
INSERT INTO storage.buckets (id, name, public) VALUES ('dog-images', 'dog-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public access to dog-images bucket
CREATE POLICY "Public Access" ON storage.objects
  FOR ALL USING (bucket_id = 'dog-images')
  WITH CHECK (bucket_id = 'dog-images');
