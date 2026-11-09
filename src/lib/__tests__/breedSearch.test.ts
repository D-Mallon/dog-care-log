import { describe, expect, it } from "vitest";
import {
  ALL_BREEDS,
  BREEDS,
  MIXED_BREED,
  UNKNOWN_BREED,
  getBreedById,
  type Breed,
} from "../../data/breeds.ts";
import {
  breedSizeLabel,
  formatBreedLabel,
  searchBreeds,
} from "../breedSearch.ts";

const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function expectRange(
  breed: Breed,
  label: string,
  range: [number, number],
): void {
  const context = `${breed.id} ${label}`;
  expect(Number.isFinite(range[0]), `${context} min`).toBe(true);
  expect(Number.isFinite(range[1]), `${context} max`).toBe(true);
  expect(range[0], `${context} positive min`).toBeGreaterThan(0);
  expect(range[1], `${context} max >= min`).toBeGreaterThanOrEqual(range[0]);
}

describe("breed catalogue", () => {
  it("has 100-150 regular breeds plus the two sentinels", () => {
    expect(BREEDS.length).toBeGreaterThanOrEqual(100);
    expect(BREEDS.length).toBeLessThanOrEqual(150);
    expect(ALL_BREEDS).toHaveLength(BREEDS.length + 2);
    expect(ALL_BREEDS).toContain(MIXED_BREED);
    expect(ALL_BREEDS).toContain(UNKNOWN_BREED);
    expect(BREEDS).not.toContain(MIXED_BREED);
    expect(BREEDS).not.toContain(UNKNOWN_BREED);
  });

  it("has unique ids and names", () => {
    const ids = ALL_BREEDS.map((breed) => breed.id);
    const names = ALL_BREEDS.map((breed) => breed.name);

    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(names).size).toBe(names.length);
  });

  it("uses stable slug ids and non-empty names", () => {
    for (const breed of ALL_BREEDS) {
      expect(breed.id, breed.name).toMatch(ID_PATTERN);
      expect(breed.name.trim(), breed.id).not.toBe("");
      expect(Array.isArray(breed.aliases), breed.id).toBe(true);
      for (const alias of breed.aliases) {
        expect(alias.trim(), `${breed.id} alias`).not.toBe("");
      }
    }
  });

  it("uses concrete sizes for catalogue breeds and unknown for sentinels", () => {
    for (const breed of BREEDS) {
      expect(breed.size, breed.id).not.toBe("unknown");
    }
    expect(MIXED_BREED.size).toBe("unknown");
    expect(UNKNOWN_BREED.size).toBe("unknown");
  });

  it("has valid positive, ordered measurement ranges", () => {
    for (const breed of ALL_BREEDS) {
      expectRange(breed, "maleWeightKg", breed.maleWeightKg);
      expectRange(breed, "femaleWeightKg", breed.femaleWeightKg);
      expectRange(breed, "heightCm", breed.heightCm);
      expectRange(breed, "lifespanYears", breed.lifespanYears);
    }
  });

  it("has ratings between 1 and 5 and usable guidance text", () => {
    for (const breed of ALL_BREEDS) {
      for (const field of [
        "energy",
        "grooming",
        "shedding",
        "trainability",
        "goodWithKids",
        "goodWithDogs",
      ] as const) {
        expect([1, 2, 3, 4, 5], `${breed.id} ${field}`).toContain(
          breed[field],
        );
      }

      expect(typeof breed.apartmentFriendly, breed.id).toBe("boolean");
      expect(breed.commonHealth.length, breed.id).toBeGreaterThan(0);
      expect(breed.exerciseNotes.trim(), breed.id).not.toBe("");
      expect(breed.careNotes.trim(), breed.id).not.toBe("");
    }
  });

  it("looks up breeds by stable id, case-insensitively", () => {
    expect(getBreedById("labrador-retriever")?.name).toBe(
      "Labrador Retriever",
    );
    expect(getBreedById("  LABRADOR-RETRIEVER  ")?.id).toBe(
      "labrador-retriever",
    );
    expect(getBreedById("mixed-breed")).toBe(MIXED_BREED);
    expect(getBreedById("unknown")).toBe(UNKNOWN_BREED);
    expect(getBreedById("not-a-real-breed")).toBeUndefined();
    expect(getBreedById("")).toBeUndefined();
    expect(getBreedById(undefined)).toBeUndefined();
    expect(getBreedById(null)).toBeUndefined();
  });
});

describe("breed search", () => {
  it("finds Labrador Retriever for a short prefix and ranks it first", () => {
    const results = searchBreeds("lab");

    expect(results[0]?.id).toBe("labrador-retriever");
    expect(results.some((breed) => breed.name === "Labrador Retriever")).toBe(
      true,
    );
  });

  it("is case-insensitive and tolerates surrounding whitespace", () => {
    expect(searchBreeds("LAB")[0]?.id).toBe("labrador-retriever");
    expect(searchBreeds("  Lab  ")[0]?.id).toBe("labrador-retriever");
  });

  it("matches aliases as well as names", () => {
    expect(searchBreeds("yorkie")[0]?.id).toBe("yorkshire-terrier");
    expect(searchBreeds("frenchie")[0]?.id).toBe("french-bulldog");
    expect(searchBreeds("doxie")[0]?.id).toBe("dachshund");
  });

  it("routes designer-cross aliases to the mixed-breed entry", () => {
    const results = searchBreeds("doodle");

    expect(results[0]).toBe(MIXED_BREED);
    expect(searchBreeds("goldendoodle")[0]).toBe(MIXED_BREED);
  });

  it("finds the mixed-breed and unknown sentinels", () => {
    expect(searchBreeds("mixed")[0]).toBe(MIXED_BREED);
    expect(searchBreeds("mutt")[0]).toBe(MIXED_BREED);
    expect(searchBreeds("unknown")[0]).toBe(UNKNOWN_BREED);
    expect(searchBreeds("not listed")[0]).toBe(UNKNOWN_BREED);
    expect(searchBreeds("I can't find it")[0]).toBe(UNKNOWN_BREED);
  });

  it("returns a sensible default list for an empty query", () => {
    const defaults = searchBreeds("");

    expect(defaults.length).toBe(20);
    const ids = defaults.map((breed) => breed.id);
    expect(ids).toContain("labrador-retriever");
    expect(ids).toContain("mixed-breed");
    expect(ids).toContain("unknown");
    expect(searchBreeds("   ")).toEqual(defaults);
  });

  it("honours the limit, including zero and limits above the result count", () => {
    expect(searchBreeds("", 5)).toHaveLength(5);
    expect(searchBreeds("", 12).map((breed) => breed.id)).toContain(
      "mixed-breed",
    );
    expect(searchBreeds("", 0)).toEqual([]);
    expect(searchBreeds("lab", 1)).toHaveLength(1);
    expect(searchBreeds("lab", 100).length).toBeLessThanOrEqual(100);
  });

  it("returns no matches rather than guessing", () => {
    expect(searchBreeds("zzzz-not-a-breed")).toEqual([]);
  });

  it("prioritises prefix matches over plain substring matches", () => {
    const results = searchBreeds("mas");
    const mastiffIndex = results.findIndex((breed) => breed.id === "mastiff");
    const bullmastiffIndex = results.findIndex(
      (breed) => breed.id === "bullmastiff",
    );

    expect(mastiffIndex).toBeGreaterThanOrEqual(0);
    expect(bullmastiffIndex).toBeGreaterThanOrEqual(0);
    expect(mastiffIndex).toBeLessThan(bullmastiffIndex);
  });

  it("matches multi-word queries regardless of word order", () => {
    const results = searchBreeds("retriever golden");
    expect(results[0]?.id).toBe("golden-retriever");
  });

  it("formats labels and size values for the UI", () => {
    expect(formatBreedLabel(MIXED_BREED)).toBe("Mixed breed");
    expect(breedSizeLabel("toy")).toBe("Toy");
    expect(breedSizeLabel("giant")).toBe("Giant");
    expect(breedSizeLabel("unknown")).toBe("Size unknown");
  });
});
