import { describe, expect, it } from "vitest";
import {
  defaultPreferences,
  validateDisplayName,
  validateEmail,
  validatePasswordChange,
} from "../profile.ts";

describe("profile validation", () => {
  it("accepts a normal display name and rejects blank/overlong names", () => {
    expect(validateDisplayName("Sarah")).toBeNull();
    expect(validateDisplayName("  ")).toMatch(/Enter/);
    expect(validateDisplayName("x".repeat(81))).toMatch(/80/);
  });

  it("validates email addresses", () => {
    expect(validateEmail("dmallon@example.com")).toBeNull();
    expect(validateEmail("not-an-email")).toMatch(/valid/);
    expect(validateEmail("")).toMatch(/Enter/);
  });

  it("requires a current password, minimum length and matching confirmation", () => {
    expect(validatePasswordChange("", "newpassword", "newpassword")).toMatch(
      /current/,
    );
    expect(validatePasswordChange("oldpassword", "short", "short")).toMatch(
      /8/,
    );
    expect(
      validatePasswordChange("oldpassword", "newpassword", "different"),
    ).toMatch(/match/);
    expect(
      validatePasswordChange("oldpassword", "oldpassword", "oldpassword"),
    ).toMatch(/different/);
    expect(
      validatePasswordChange("oldpassword", "newpassword", "newpassword"),
    ).toBeNull();
  });

  it("returns safe default preferences", () => {
    const defaults = defaultPreferences();
    expect(defaults.emailReminders).toBe(false);
    expect(defaults.weeklySummary).toBe(false);
    expect(defaults.productUpdates).toBe(false);
    expect(defaults.timezone.length).toBeGreaterThan(0);
  });
});
