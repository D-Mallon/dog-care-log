import type { User } from "npm:@supabase/supabase-js@2";
import { HttpError } from "./errors.ts";
import { createUserClient, requireUser } from "./supabase.ts";

interface MembershipRow {
  householdId: string;
  role: string;
  status: string;
}

export interface HouseholdOwner {
  user: User;
  householdId: string;
}

/**
 * Require an authenticated caller who is an active owner of their household.
 *
 * The ownership query runs through the caller's JWT so RLS is part of the
 * check. Billing is owner-only in Release 1; members can view entitlement but
 * cannot start checkout or open the Customer Portal.
 */
export async function requireHouseholdOwner(
  req: Request,
): Promise<HouseholdOwner> {
  const { user, accessToken } = await requireUser(req);
  const supabase = createUserClient(accessToken);

  const { data, error } = await supabase
    .from("HouseholdMember")
    .select("householdId, role, status")
    .eq("userId", user.id)
    .eq("status", "active")
    .eq("role", "owner")
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Failed to load household membership:", error);
    throw new HttpError(
      500,
      "Could not verify your household. Please try again.",
      "membership_lookup_failed",
    );
  }

  const membership = data as MembershipRow | null;
  if (!membership) {
    throw new HttpError(
      403,
      "Only the household owner can manage billing.",
      "owner_required",
    );
  }

  const { data: household, error: householdError } = await supabase
    .from("Household")
    .select("id")
    .eq("id", membership.householdId)
    .maybeSingle();

  if (householdError) {
    console.error("Failed to load household:", householdError);
    throw new HttpError(
      500,
      "Could not verify your household. Please try again.",
      "household_lookup_failed",
    );
  }

  if (!household) {
    throw new HttpError(404, "Household not found.", "household_not_found");
  }

  return { user, householdId: membership.householdId };
}
