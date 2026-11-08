import { describe, expect, it } from "vitest";
import { getCareUrgency } from "../careStatus.ts";

describe("care urgency", () => {
  const now = new Date("2026-11-08T12:00:00Z");

  it("returns no-record for missing timestamps", () => {
    expect(getCareUrgency(null, "feed", now)).toBe("no-record");
  });

  it("classifies a recent feed as up to date", () => {
    expect(getCareUrgency("2026-11-08T10:00:00Z", "feed", now)).toBe("ok");
  });

  it("classifies a feed approaching the threshold as due soon", () => {
    expect(getCareUrgency("2026-11-08T01:00:00Z", "feed", now)).toBe(
      "due-soon",
    );
  });

  it("classifies a long gap as overdue", () => {
    expect(getCareUrgency("2026-11-07T20:00:00Z", "feed", now)).toBe(
      "overdue",
    );
  });

  it("ignores event types without a configured threshold", () => {
    expect(getCareUrgency("2020-01-01T00:00:00Z", "sick", now)).toBe(
      "no-record",
    );
  });
});
