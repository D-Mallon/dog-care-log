import { describe, expect, it } from "vitest";
import {
  formatDurationHours,
  fromDateTimeLocalValue,
  hoursBetween,
  isFutureDateTime,
  toDateTimeLocalValue,
} from "../dates.ts";

describe("date helpers", () => {
  it("formats a local datetime input value", () => {
    expect(toDateTimeLocalValue(new Date(2026, 0, 2, 3, 4))).toBe(
      "2026-01-02T03:04",
    );
  });

  it("parses a local datetime input to ISO", () => {
    const local = "2026-01-02T03:04";
    expect(fromDateTimeLocalValue(local)).toBe(
      new Date(2026, 0, 2, 3, 4).toISOString(),
    );
  });

  it("rejects empty and invalid input", () => {
    expect(fromDateTimeLocalValue("")).toBeNull();
    expect(fromDateTimeLocalValue("not-a-date")).toBeNull();
  });

  it("detects future timestamps", () => {
    const now = new Date("2026-11-08T12:00:00Z");
    expect(isFutureDateTime("2026-11-08T13:00:00Z", now)).toBe(true);
    expect(isFutureDateTime("2026-11-08T11:00:00Z", now)).toBe(false);
  });

  it("formats durations", () => {
    expect(formatDurationHours(0.5)).toBe("30m");
    expect(formatDurationHours(2.5)).toBe("2.5h");
    expect(formatDurationHours(26)).toBe("1d 2h");
  });

  it("calculates hours between timestamps", () => {
    expect(
      hoursBetween(
        "2026-11-08T10:00:00Z",
        "2026-11-08T12:30:00Z",
      ),
    ).toBe(2.5);
  });
});
