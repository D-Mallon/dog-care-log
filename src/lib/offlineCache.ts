import type { CareEvent, Dog, WeightLog } from "../types/core.ts";

export type HouseholdSnapshot = {
  dogs: Dog[];
  events: CareEvent[];
  weightLogs: WeightLog[];
  cachedAt: string;
};

const KEY_PREFIX = "loggi:snapshot:v1:";

function keyFor(userId: string): string {
  return `${KEY_PREFIX}${userId}`;
}

export function saveHouseholdSnapshot(
  userId: string,
  snapshot: Omit<HouseholdSnapshot, "cachedAt">,
): void {
  try {
    const payload: HouseholdSnapshot = {
      ...snapshot,
      cachedAt: new Date().toISOString(),
    };
    localStorage.setItem(keyFor(userId), JSON.stringify(payload));
  } catch {
    // Private mode, quota exceeded, or storage disabled — cache is optional.
  }
}

export function loadHouseholdSnapshot(
  userId: string,
): HouseholdSnapshot | null {
  try {
    const raw = localStorage.getItem(keyFor(userId));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isSnapshot(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearHouseholdSnapshot(userId: string): void {
  try {
    localStorage.removeItem(keyFor(userId));
  } catch {
    // Ignore storage failures.
  }
}

function isSnapshot(value: unknown): value is HouseholdSnapshot {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<HouseholdSnapshot>;
  return (
    Array.isArray(candidate.dogs) &&
    Array.isArray(candidate.events) &&
    Array.isArray(candidate.weightLogs) &&
    typeof candidate.cachedAt === "string"
  );
}
