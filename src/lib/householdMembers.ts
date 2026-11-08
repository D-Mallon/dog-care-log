import type { HouseholdMember } from "../types/core.ts";

export function getMemberDisplayName(
  members: HouseholdMember[],
  userId: string,
): string {
  const member = members.find((item) => item.userId === userId);
  if (!member) return "Unknown member";
  return member.displayName?.trim() || "Household member";
}

export function getMemberLabel(
  members: HouseholdMember[],
  userId: string,
  currentUserId: string,
): string {
  if (userId === currentUserId) return "You";
  return getMemberDisplayName(members, userId);
}

export function sortHouseholdMembers(
  members: HouseholdMember[],
): HouseholdMember[] {
  return [...members].sort((a, b) => {
    if (a.status !== b.status) return a.status === "active" ? -1 : 1;
    if (a.role !== b.role) return a.role === "owner" ? -1 : 1;
    return (a.displayName ?? "").localeCompare(b.displayName ?? "");
  });
}

export function isHouseholdOwner(
  members: HouseholdMember[],
  userId: string,
): boolean {
  return members.some(
    (member) =>
      member.userId === userId &&
      member.role === "owner" &&
      member.status === "active",
  );
}
