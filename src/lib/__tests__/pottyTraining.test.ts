import { describe, expect, it } from "vitest";
import type { CareEvent, Dog } from "../../types/core.ts";
import { summarizePotty } from "../pottyTraining.ts";

const NOW = new Date(2026, 10, 9, 12, 0, 0); // 9 Nov 2026, local noon

function localIso(day: number, hour: number, minute = 0): string {
  return new Date(2026, 10, day, hour, minute, 0, 0).toISOString();
}

function makeDog(overrides: Partial<Dog> = {}): Dog {
  return {
    dogId: "dog-1",
    dogName: "Riley",
    householdId: "household-1",
    dogImage: "",
    age: 3,
    ...overrides,
  };
}

function toiletEvent(
  id: string,
  timestamp: string,
  overrides: Partial<CareEvent> = {},
): CareEvent {
  return {
    id,
    dogId: "dog-1",
    type: "toilet",
    timestamp,
    userId: "user-1",
    ...overrides,
  };
}

function success(
  id: string,
  timestamp: string,
  overrides: Partial<CareEvent> = {},
): CareEvent {
  return toiletEvent(id, timestamp, {
    subtype: "pee",
    pottyOutcome: "success",
    ...overrides,
  });
}

describe("summarizePotty", () => {
  it("returns a safe empty summary when there are no events", () => {
    const summary = summarizePotty([], makeDog(), NOW);

    expect(summary.todaySuccess).toBe(0);
    expect(summary.todayAccidents).toBe(0);
    expect(summary.successRate7d).toBeNull();
    expect(summary.accidents7d).toBe(0);
    expect(summary.medianIntervalHours).toBeNull();
    expect(summary.nextWindowStart).toBeNull();
    expect(summary.nextWindowEnd).toBeNull();
    expect(summary.lastPottyAt).toBeNull();
    expect(summary.accidentPattern).toBeNull();
    expect(summary.confidence).toBe("low");
    expect(summary.tips.length).toBeGreaterThanOrEqual(1);
    expect(summary.tips.length).toBeLessThanOrEqual(3);
    expect(summary.tips.join(" ")).toMatch(/not veterinary advice/i);
  });

  it("counts today's outcomes and the rolling 7-day success rate", () => {
    const events = [
      success("success-today", localIso(9, 9)),
      toiletEvent("accident-today", localIso(9, 11), {
        pottyOutcome: "accident",
      }),
      success("success-3d", localIso(6, 9)),
      toiletEvent("accident-4d", localIso(5, 9), {
        pottyOutcome: "accident",
      }),
      success("success-8d", localIso(1, 9)),
      toiletEvent("feed-today", localIso(9, 10), { type: "feed" }),
    ];

    const summary = summarizePotty(events, makeDog(), NOW);

    expect(summary.todaySuccess).toBe(1);
    expect(summary.todayAccidents).toBe(1);
    expect(summary.accidents7d).toBe(2);
    expect(summary.successRate7d).toBeCloseTo(0.5, 5);
  });

  it("uses the median interval to build the next window", () => {
    const now = new Date(2026, 10, 9, 20, 0, 0);
    const events = [
      success("1", localIso(9, 8)),
      success("2", localIso(9, 10)),
      success("3", localIso(9, 13)),
    ];

    const summary = summarizePotty(events, makeDog(), now);

    expect(summary.medianIntervalHours).toBe(2.5);
    expect(summary.lastPottyAt).toBe(localIso(9, 13));
    expect(summary.nextWindowStart).toBe(localIso(9, 15));
    expect(summary.nextWindowEnd).toBe(localIso(9, 16));
  });

  it("returns an overdue window instead of hiding it", () => {
    const events = [
      success("1", localIso(9, 4)),
      success("2", localIso(9, 6)),
      success("3", localIso(9, 8)),
    ];

    const summary = summarizePotty(events, makeDog(), NOW);

    expect(summary.medianIntervalHours).toBe(2);
    expect(summary.nextWindowStart).toBe(localIso(9, 9, 30));
    expect(summary.nextWindowEnd).toBe(localIso(9, 10, 30));
    expect(new Date(summary.nextWindowStart ?? "").getTime()).toBeLessThan(
      NOW.getTime(),
    );
    expect(new Date(summary.nextWindowEnd ?? "").getTime()).toBeLessThan(
      NOW.getTime(),
    );
  });

  it("falls back to an age-based default for a young puppy", () => {
    const dog = makeDog({
      age: undefined,
      dateOfBirth: new Date(2026, 8, 15, 12, 0, 0).toISOString(),
    });
    const events = [success("1", localIso(9, 10))];

    const summary = summarizePotty(events, dog, NOW);

    expect(summary.medianIntervalHours).toBeNull();
    expect(summary.confidence).toBe("low");
    // Under three months: default 1.5h -> 10:00 + 1.5h, +/- 30m.
    expect(summary.nextWindowStart).toBe(localIso(9, 11));
    expect(summary.nextWindowEnd).toBe(localIso(9, 12));
    expect(summary.tips.join(" ")).toMatch(/under six months/i);
  });

  it("falls back to the adult default interval when age is known", () => {
    const dog = makeDog({ age: 3 });
    const events = [success("1", localIso(9, 10))];

    const summary = summarizePotty(events, dog, NOW);

    expect(summary.medianIntervalHours).toBeNull();
    expect(summary.confidence).toBe("low");
    // Adult default 5h -> 10:00 + 5h, +/- 30m.
    expect(summary.nextWindowStart).toBe(localIso(9, 14, 30));
    expect(summary.nextWindowEnd).toBe(localIso(9, 15, 30));
  });

  it("keeps confidence low when the sample is tiny", () => {
    const events = [success("1", localIso(9, 8)), success("2", localIso(9, 9))];

    const summary = summarizePotty(events, makeDog(), NOW);

    expect(summary.medianIntervalHours).toBe(1);
    expect(summary.confidence).toBe("low");
  });

  it("treats legacy isAccident as an accident and unclassified events as neither", () => {
    const events = [
      success("1", localIso(9, 8)),
      toiletEvent("2", localIso(9, 9), { isAccident: false }),
      toiletEvent("3", localIso(9, 10), { isAccident: true }),
    ];

    const summary = summarizePotty(events, makeDog(), NOW);

    expect(summary.todaySuccess).toBe(1);
    expect(summary.todayAccidents).toBe(1);
    expect(summary.accidents7d).toBe(1);
    expect(summary.successRate7d).toBeCloseTo(0.5, 5);
  });

  it("prefers a structured outcome over a conflicting legacy flag", () => {
    const events = [
      toiletEvent("1", localIso(9, 9), {
        pottyOutcome: "success",
        isAccident: true,
      }),
    ];

    const summary = summarizePotty(events, makeDog(), NOW);

    expect(summary.todaySuccess).toBe(1);
    expect(summary.todayAccidents).toBe(0);
    expect(summary.successRate7d).toBe(1);
  });

  it("uses all toilet events when pottyOutcome is absent", () => {
    const events = [
      toiletEvent("1", localIso(9, 8), { isAccident: false }),
      toiletEvent("2", localIso(9, 10), { isAccident: true }),
      toiletEvent("3", localIso(9, 12), { isAccident: false }),
    ];

    const summary = summarizePotty(events, makeDog(), NOW);

    // 8 -> 10 -> 12 gives 2h intervals; excluding the legacy accident would
    // incorrectly produce a single 4h interval.
    expect(summary.medianIntervalHours).toBe(2);
    // Legacy events are unclassified, never counted as successes.
    expect(summary.todaySuccess).toBe(0);
    expect(summary.accidents7d).toBe(1);
    expect(summary.successRate7d).toBe(0);
  });

  it("describes an accident pattern from the median gap since the previous break", () => {
    const now = new Date(2026, 10, 9, 20, 0, 0);
    const events = [
      success("1", localIso(9, 8)),
      toiletEvent("2", localIso(9, 11, 30), {
        pottyOutcome: "accident",
      }),
      success("3", localIso(9, 13)),
      toiletEvent("4", localIso(9, 16, 30), {
        pottyOutcome: "accident",
      }),
    ];

    const summary = summarizePotty(events, makeDog(), now);

    expect(summary.accidents7d).toBe(2);
    expect(summary.accidentPattern).not.toBeNull();
    expect(summary.accidentPattern).toMatch(/3\.5h/);
    expect(summary.accidentPattern).toMatch(/last toilet break/i);
    expect(summary.accidentPattern).toMatch(/2 logged/);
  });

  it("ignores intervals outside the 15-minute to puppy/adult limits", () => {
    const now = new Date(2026, 10, 9, 20, 0, 0);
    const puppy = makeDog({
      age: undefined,
      dateOfBirth: new Date(2026, 8, 15, 12, 0, 0).toISOString(),
    });
    const events = [
      success("1", localIso(9, 6)),
      success("2", localIso(9, 6, 10)), // 10 minutes: too short
      success("3", localIso(9, 19)), // 12h50m: too long for a puppy
      success("future", localIso(9, 22)), // after "now": ignored
    ];

    const puppySummary = summarizePotty(events, puppy, now);
    expect(puppySummary.medianIntervalHours).toBeNull();
    expect(puppySummary.lastPottyAt).toBe(localIso(9, 19));

    const adultSummary = summarizePotty(events, makeDog({ age: 3 }), now);
    expect(adultSummary.medianIntervalHours).toBe(12.8);

    const longGap = summarizePotty(
      [success("a", localIso(8, 10)), success("b", localIso(9, 12))],
      makeDog({ age: 3 }),
      now,
    );
    // 26 hours apart: too long to be a useful adult cadence signal.
    expect(longGap.medianIntervalHours).toBeNull();
  });

  it("raises confidence with enough adult interval data and caps it for puppies", () => {
    const events = [
      success("1", localIso(9, 8)),
      success("2", localIso(9, 9)),
      success("3", localIso(9, 10)),
      success("4", localIso(9, 11)),
      success("5", localIso(9, 12)),
      success("6", localIso(9, 13)),
    ];
    const now = new Date(2026, 10, 9, 14, 0, 0);

    const adultSummary = summarizePotty(events, makeDog({ age: 3 }), now);
    expect(adultSummary.medianIntervalHours).toBe(1);
    expect(adultSummary.confidence).toBe("high");

    const unknownAgeSummary = summarizePotty(
      events,
      makeDog({ age: undefined }),
      now,
    );
    expect(unknownAgeSummary.confidence).toBe("high");

    const puppySummary = summarizePotty(
      events,
      makeDog({
        age: undefined,
        dateOfBirth: new Date(2026, 7, 9, 12, 0, 0).toISOString(),
      }),
      now,
    );
    expect(puppySummary.confidence).toBe("medium");
  });

  it("acknowledges a dog that is starting to ask to go out", () => {
    const events = [
      success("1", localIso(9, 8), { pottyCue: "asked" }),
      success("2", localIso(9, 9), { pottyCue: "asked" }),
      success("3", localIso(9, 10), { pottyCue: "asked" }),
    ];

    const summary = summarizePotty(events, makeDog({ age: 3 }), NOW);

    expect(summary.tips.join(" ")).toMatch(/asking/i);
  });

  it("always returns one to three tips framed as general guidance", () => {
    const events = [success("1", localIso(9, 8))];

    for (const dog of [
      makeDog({ age: 3 }),
      makeDog({
        age: undefined,
        dateOfBirth: new Date(2026, 8, 15, 12, 0, 0).toISOString(),
      }),
    ]) {
      const summary = summarizePotty(events, dog, NOW);
      expect(summary.tips.length).toBeGreaterThanOrEqual(1);
      expect(summary.tips.length).toBeLessThanOrEqual(3);
      expect(summary.tips[summary.tips.length - 1]).toMatch(
        /not veterinary advice/i,
      );
    }
  });
});
