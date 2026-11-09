import { describe, expect, it } from "vitest";
import type {
  CareEvent,
  Dog,
  EventType,
  WeightLog,
} from "../../types/core.ts";
import {
  buildWeeklyReport,
  GENERAL_OBSERVATION_PREFIX,
  WEEKLY_REPORT_DISCLAIMER,
} from "../weeklyReport.ts";

// Local noon on 9 November 2026. Using local constructors keeps the tests
// portable across time zones.
const NOW = new Date(2026, 10, 9, 12, 0, 0);

function localIso(
  day: number,
  hour: number,
  minute = 0,
  second = 0,
  millisecond = 0,
): string {
  return new Date(2026, 10, day, hour, minute, second, millisecond).toISOString();
}

function makeDog(dogId: string, dogName = dogId): Dog {
  return {
    dogId,
    dogName,
    householdId: "household-1",
    dogImage: "",
  };
}

function makeEvent(
  id: string,
  dogId: string,
  type: EventType,
  timestamp: string,
  extra: Partial<CareEvent> = {},
): CareEvent {
  return {
    id,
    dogId,
    type,
    timestamp,
    userId: "user-1",
    ...extra,
  };
}

function makeWeight(
  id: string,
  dogId: string,
  weight: number,
  timestamp: string,
): WeightLog {
  return { id, dogId, weight, recordedAt: timestamp };
}

function allObservations(report: ReturnType<typeof buildWeeklyReport>): string[] {
  return [...report.highlights, ...report.concerns];
}

describe("weekly progress report", () => {
  it("returns a safe, labelled empty report when there is no data", () => {
    const report = buildWeeklyReport([], [], [], NOW);

    expect(report.dogs).toEqual([]);
    expect(report.household.dogCount).toBe(0);
    expect(report.household.eventCount).toBe(0);
    expect(report.household.pottySuccessRate).toBeNull();
    expect(report.household.activeDayCount).toBe(0);
    expect(report.household.averageEventsPerActiveDay).toBe(0);
    expect(report.window.days).toBe(7);
    expect(report.window.start).toBe(new Date(2026, 10, 3).toISOString());
    expect(report.window.end).toBe(NOW.toISOString());
    expect(report.generatedAt).toBe(NOW.toISOString());
    expect(report.disclaimer).toBe(WEEKLY_REPORT_DISCLAIMER);
    expect(report.concerns).toHaveLength(1);
    expect(report.concerns[0]).toContain("No dogs");
    expect(report.highlights).toEqual([]);
  });

  it("computes per-dog and household potty success rates from pottyOutcome", () => {
    const report = buildWeeklyReport(
      [makeDog("dog-1", "Milo")],
      [
        makeEvent("1", "dog-1", "toilet", localIso(8, 9), {
          pottyOutcome: "success",
        }),
        makeEvent("2", "dog-1", "toilet", localIso(8, 13), {
          pottyOutcome: "success",
        }),
        makeEvent("3", "dog-1", "toilet", localIso(9, 9), {
          pottyOutcome: "success",
        }),
        makeEvent("4", "dog-1", "toilet", localIso(9, 10), {
          pottyOutcome: "accident",
        }),
      ],
      [],
      NOW,
    );

    expect(report.dogs[0].toiletCount).toBe(4);
    expect(report.dogs[0].pottySuccessCount).toBe(3);
    expect(report.dogs[0].pottyAccidentCount).toBe(1);
    expect(report.dogs[0].pottySuccessRate).toBe(0.75);
    expect(report.household.pottySuccessRate).toBe(0.75);
    expect(report.dogs[0].activeDayCount).toBe(2);
    expect(report.dogs[0].averageEventsPerActiveDay).toBe(2);
    expect(report.highlights.some((text) => text.includes("3 of 4"))).toBe(
      true,
    );
  });

  it("falls back to isAccident, prefers pottyOutcome, and excludes legacy unclassified events", () => {
    const report = buildWeeklyReport(
      [makeDog("dog-1"), makeDog("dog-2")],
      [
        // pottyOutcome wins even when the older flag disagrees.
        makeEvent("1", "dog-1", "toilet", localIso(8, 8), {
          pottyOutcome: "success",
          isAccident: true,
        }),
        makeEvent("2", "dog-1", "toilet", localIso(8, 9), {
          isAccident: false,
        }),
        makeEvent("3", "dog-1", "toilet", localIso(8, 10), {
          isAccident: true,
        }),
        makeEvent("4", "dog-1", "toilet", localIso(8, 11)),
        makeEvent("5", "dog-1", "toilet", localIso(8, 12), {
          pottyOutcome: "accident",
          isAccident: false,
        }),
        makeEvent("6", "dog-2", "toilet", localIso(9, 9)),
      ],
      [],
      NOW,
    );

    const firstDog = report.dogs[0];
    expect(firstDog.pottySuccessCount).toBe(2);
    expect(firstDog.pottyAccidentCount).toBe(2);
    expect(firstDog.pottySuccessRate).toBe(0.5);
    expect(firstDog.toiletCount).toBe(5);

    // Every toilet event on the second dog is legacy/unclassified.
    expect(report.dogs[1].toiletCount).toBe(1);
    expect(report.dogs[1].pottySuccessRate).toBeNull();

    expect(report.household.toiletCount).toBe(6);
    expect(report.household.pottySuccessRate).toBe(0.5);
    expect(
      report.concerns.some((text) => text.includes("2 toilet events")),
    ).toBe(true);
    expect(
      report.concerns.some((text) => text.includes("not included in the success rate")),
    ).toBe(true);
  });

  it("counts active days, averages events per active day, and measures consistency", () => {
    const report = buildWeeklyReport(
      [makeDog("dog-1")],
      [
        makeEvent("1", "dog-1", "feed", localIso(3, 8)),
        makeEvent("2", "dog-1", "walk", localIso(3, 12)),
        makeEvent("3", "dog-1", "feed", localIso(4, 8)),
        makeEvent("4", "dog-1", "walk", localIso(5, 12)),
        makeEvent("5", "dog-1", "feed", localIso(9, 8)),
        // Outside the window.
        makeEvent("6", "dog-1", "feed", localIso(2, 23, 59)),
      ],
      [],
      NOW,
    );

    const dog = report.dogs[0];
    expect(dog.eventCount).toBe(5);
    expect(dog.activeDayCount).toBe(4);
    expect(dog.averageEventsPerActiveDay).toBe(1.3);
    expect(dog.consistency.feedDays).toBe(3);
    expect(dog.consistency.walkDays).toBe(2);
    expect(dog.consistency.careDays).toBe(4);
    expect(dog.consistency.daysInWindow).toBe(7);
    expect(dog.consistency.longestCareStreak).toBe(3);
    expect(report.household.activeDayCount).toBe(4);
    expect(report.household.averageEventsPerActiveDay).toBe(1.3);
  });

  it("computes weight start, end and change from in-window logs only", () => {
    const report = buildWeeklyReport(
      [makeDog("dog-1")],
      [],
      [
        makeWeight("w1", "dog-1", 10, localIso(4, 8)),
        makeWeight("w2", "dog-1", 10.2, localIso(4, 20)),
        makeWeight("w3", "dog-1", 10.6, localIso(9, 8)),
        // Before the window and therefore ignored.
        makeWeight("w4", "dog-1", 9, localIso(2, 8)),
      ],
      NOW,
    );

    expect(report.dogs[0].weightLogCount).toBe(3);
    expect(report.dogs[0].weight).toEqual({
      startWeight: 10,
      endWeight: 10.6,
      change: 0.6,
      logCount: 3,
    });
    expect(report.household.dogsWithWeightTrend).toBe(1);
    expect(report.household.weightLogCount).toBe(3);
  });

  it("returns null weight data when there are no logs or only one log", () => {
    const report = buildWeeklyReport(
      [makeDog("dog-1"), makeDog("dog-2")],
      [],
      [makeWeight("w1", "dog-1", 12.4, localIso(8, 8))],
      NOW,
    );

    expect(report.dogs[0].weight).toBeNull();
    expect(report.dogs[0].weightLogCount).toBe(1);
    expect(report.dogs[1].weight).toBeNull();
    expect(report.dogs[1].weightLogCount).toBe(0);
    expect(report.household.dogsWithWeightTrend).toBe(0);
    expect(
      report.concerns.some((text) => text.includes("one weigh-in")),
    ).toBe(true);
  });

  it("keeps per-dog summaries separate, including a zero success rate and a null rate", () => {
    const report = buildWeeklyReport(
      [makeDog("dog-1", "Milo"), makeDog("dog-2", "Nala"), makeDog("dog-3", "Pip")],
      [
        makeEvent("1", "dog-1", "feed", localIso(8, 8)),
        makeEvent("2", "dog-1", "feed", localIso(9, 8)),
        makeEvent("3", "dog-1", "walk", localIso(8, 12)),
        makeEvent("4", "dog-1", "toilet", localIso(8, 9), {
          pottyOutcome: "success",
        }),
        makeEvent("5", "dog-1", "toilet", localIso(9, 9), {
          pottyOutcome: "success",
        }),
        makeEvent("6", "dog-1", "toilet", localIso(9, 10), {
          pottyOutcome: "accident",
        }),
        makeEvent("7", "dog-2", "walk", localIso(8, 12)),
        makeEvent("8", "dog-2", "feed", localIso(8, 18)),
        makeEvent("9", "dog-2", "toilet", localIso(8, 19), {
          pottyOutcome: "accident",
        }),
      ],
      [],
      NOW,
    );

    expect(report.dogs.map((dog) => dog.dogName)).toEqual([
      "Milo",
      "Nala",
      "Pip",
    ]);
    expect(report.dogs[0].eventCount).toBe(6);
    expect(report.dogs[0].feedCount).toBe(2);
    expect(report.dogs[0].walkCount).toBe(1);
    expect(report.dogs[1].eventCount).toBe(3);
    expect(report.dogs[1].feedCount).toBe(1);
    expect(report.dogs[1].walkCount).toBe(1);
    expect(report.dogs[1].pottySuccessRate).toBe(0);
    expect(report.dogs[2].eventCount).toBe(0);
    expect(report.dogs[2].pottySuccessRate).toBeNull();
    expect(report.dogs[2].weight).toBeNull();

    expect(report.household.eventCount).toBe(9);
    expect(report.household.feedCount).toBe(3);
    expect(report.household.walkCount).toBe(2);
    expect(report.household.toiletCount).toBe(4);
    expect(report.household.pottySuccessCount).toBe(2);
    expect(report.household.pottyAccidentCount).toBe(2);
    expect(report.household.pottySuccessRate).toBe(0.5);
  });

  it("excludes events outside the local seven-day window, invalid timestamps and unknown dogs", () => {
    const report = buildWeeklyReport(
      [makeDog("dog-1")],
      [
        // First included instant: local midnight six days before now.
        makeEvent("1", "dog-1", "feed", new Date(2026, 10, 3, 0, 0, 0).toISOString()),
        makeEvent("2", "dog-1", "walk", localIso(8, 12)),
        // Last included instant: exactly `now`.
        makeEvent("3", "dog-1", "feed", NOW.toISOString()),
        // Just outside the window on both ends.
        makeEvent("4", "dog-1", "feed", localIso(2, 23, 59)),
        makeEvent("5", "dog-1", "feed", localIso(9, 12, 0, 0, 1)),
        makeEvent("6", "dog-1", "feed", "not-a-date"),
        // Belongs to a dog that is not part of this report.
        makeEvent("7", "other-dog", "feed", localIso(8, 12)),
      ],
      [],
      NOW,
    );

    expect(report.window.start).toBe(
      new Date(2026, 10, 3, 0, 0, 0).toISOString(),
    );
    expect(report.dogs[0].eventCount).toBe(3);
    expect(report.household.eventCount).toBe(3);
  });

  it("handles a week containing a dog but no events without NaN or invented values", () => {
    const report = buildWeeklyReport([makeDog("dog-1", "Milo")], [], [], NOW);

    expect(report.household.eventCount).toBe(0);
    expect(report.household.pottySuccessRate).toBeNull();
    expect(report.household.averageEventsPerActiveDay).toBe(0);
    expect(report.dogs[0].eventCount).toBe(0);
    expect(report.dogs[0].pottySuccessRate).toBeNull();
    expect(report.dogs[0].weight).toBeNull();
    expect(report.highlights).toEqual([]);
    expect(report.concerns.some((text) => text.includes("Milo"))).toBe(true);
    expect(JSON.stringify(report)).not.toContain("NaN");
    expect(JSON.stringify(report)).not.toContain("Infinity");
  });

  it("uses non-judgemental, general-observation language and never claims a diagnosis", () => {
    const report = buildWeeklyReport(
      [makeDog("dog-1", "Milo")],
      [
        makeEvent("1", "dog-1", "toilet", localIso(8, 9), {
          pottyOutcome: "accident",
        }),
        makeEvent("2", "dog-1", "toilet", localIso(8, 10)),
      ],
      [makeWeight("w1", "dog-1", 11, localIso(8, 8))],
      NOW,
    );

    const observations = allObservations(report);
    expect(observations.length).toBeGreaterThan(0);
    expect(report.disclaimer).toContain("not veterinary advice");
    expect(report.disclaimer).toContain("contact your veterinarian");

    for (const text of observations) {
      expect(text.startsWith(GENERAL_OBSERVATION_PREFIX)).toBe(true);
      expect(text).toContain("not veterinary advice");

      // No shaming or directive language.
      expect(text).not.toMatch(
        /\b(bad|failed|failure|shame|guilty|unacceptable|neglect|irresponsible|should)\b/i,
      );

      // If a medical-sounding word appears, it must be an explicit denial.
      if (/diagnos/i.test(text)) {
        expect(text).toContain("not a diagnosis");
      }
    }
  });
});
