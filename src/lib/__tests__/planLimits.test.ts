import { describe, expect, it } from "vitest";
import { canAddAnotherDog } from "../planLimits.ts";

describe("free plan dog limit", () => {
  it("allows an unentitled household's first dog", () => {
    expect(canAddAnotherDog(false, 0)).toBe(true);
  });

  it("blocks a second dog on the free plan", () => {
    expect(canAddAnotherDog(false, 1)).toBe(false);
    expect(canAddAnotherDog(false, 3)).toBe(false);
  });

  it("allows unlimited dogs when entitled", () => {
    expect(canAddAnotherDog(true, 0)).toBe(true);
    expect(canAddAnotherDog(true, 10)).toBe(true);
  });

  it("stays permissive while the plan is unknown", () => {
    expect(canAddAnotherDog(false, 3, false)).toBe(true);
  });
});
