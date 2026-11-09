import type { Dog } from "../types/core.ts";

/** Whole years between date of birth and now, or undefined for invalid input. */
export function ageYearsFromDateOfBirth(
  dateOfBirth: string | undefined,
  now: Date = new Date(),
): number | undefined {
  if (!dateOfBirth) return undefined;
  const birth = new Date(`${dateOfBirth}T00:00:00`);
  if (Number.isNaN(birth.getTime())) return undefined;
  if (birth.getTime() > now.getTime()) return undefined;

  let years = now.getFullYear() - birth.getFullYear();
  const monthDelta = now.getMonth() - birth.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < birth.getDate())) {
    years -= 1;
  }
  return Math.max(0, years);
}

/**
 * Prefer date of birth over the legacy integer age. The returned age is a whole
 * year; use `dateOfBirth` directly when month-level precision matters.
 */
export function dogAgeYears(dog: Dog, now: Date = new Date()): number | undefined {
  return ageYearsFromDateOfBirth(dog.dateOfBirth, now) ?? dog.age;
}

export function dogAgeLabel(dog: Dog, now: Date = new Date()): string | null {
  const years = dogAgeYears(dog, now);
  if (years === undefined) return null;
  if (years === 0) return "Under 1 year";
  return `${years} ${years === 1 ? "year" : "years"}`;
}

export function dogLifeStage(
  dog: Dog,
  now: Date = new Date(),
): "puppy" | "adolescent" | "adult" | "senior" | "unknown" {
  if (dog.trainingStage && dog.trainingStage !== "unknown") {
    return dog.trainingStage;
  }

  const years = dogAgeYears(dog, now);
  if (years === undefined) return "unknown";
  if (years < 1) return "puppy";
  if (years < 2) return "adolescent";
  if (years < 8) return "adult";
  return "senior";
}
