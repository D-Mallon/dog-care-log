import { describe, expect, it } from "vitest";
import type { CareEvent } from "../../types/core.ts";
import { getPottyInsights } from "../predictions.ts";

function localIso(day: number, hour: number, minute = 0): string {
  return new Date(2026, 10, day, hour, minute, 0).toISOString();
}

function toiletEvent(
  id: string,
  timestamp: string,
  subtype: "pee" | "poo" = "pee",
): CareEvent {
  return {
    id,
    dogId: "dog-1",
    type: "toilet",
    subtype,
    timestamp,
    userId: "user-1",
  };
}

describe("potty insights", () => {
  const now = new Date(2026, 10, 8, 12, 0, 0);

  it("returns null with too little data", () => {
    const events = [
      toiletEvent("1", localIso(8, 10)),
      toiletEvent("2", localIso(8, 11)),
    ];
    expect(getPottyInsights(events, now)).toBeNull();
  });

  it("predicts the next pee from the last pee plus the median interval", () => {
    const events = [
      toiletEvent("1", localIso(8, 8)),
      toiletEvent("2", localIso(8, 10)),
      toiletEvent("3", localIso(8, 12)),
    ];

    const insights = getPottyInsights(events, now);

    expect(insights).not.toBeNull();
    expect(insights?.medianPeeIntervalHours).toBe(2);
    expect(insights?.nextPeeDueAt).not.toBeNull();
    expect(new Date(insights?.nextPeeDueAt ?? "").getHours()).toBe(14);
    expect(insights?.peeStatus).toBe("upcoming");
    expect(insights?.summary[0]).toContain("due in ~2h");
  });

  it("reports overdue rather than pretending the next pee is in the future", () => {
    const events = [
      toiletEvent("1", localIso(8, 2)),
      toiletEvent("2", localIso(8, 4)),
      toiletEvent("3", localIso(8, 6)),
    ];

    const insights = getPottyInsights(events, now);

    expect(insights?.peeStatus).toBe("overdue");
    expect(insights?.hoursUntilDue).toBe(-4);
    expect(insights?.summary[0]).toContain("overdue by ~4h");
  });

  it("includes morning poo and accident patterns when present", () => {
    const events = [
      toiletEvent("1", localIso(6, 6)),
      toiletEvent("2", localIso(7, 6, 30), "poo"),
      {
        ...toiletEvent("3", localIso(8, 8), "poo"),
        isAccident: true,
      },
      toiletEvent("4", localIso(8, 10)),
    ];

    const insights = getPottyInsights(events, now);

    expect(insights?.accidentCount).toBe(1);
    expect(insights?.morningPooCount).toBe(2);
    expect(insights?.morningPooAverageTime).toBe("07:15");
    expect(insights?.summary.some((line) => line.includes("Morning poo"))).toBe(
      true,
    );
  });
});
