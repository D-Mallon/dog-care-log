import { describe, expect, it } from "vitest";
import type { CareEvent, Dog, WeightLog } from "../../types/core.ts";
import {
  buildHealthBaseline,
  formatHealthInsightForExport,
  HEALTH_BASELINE_DISCLAIMER,
} from "../healthBaseline.ts";

// Local evening on 9 Nov 2026, so every fixture event for days 7-9 is in the
// past and the full local dates are inside the recent clock window.
const NOW = new Date(2026, 10, 9, 23, 0, 0);

const DAY_MS = 24 * 60 * 60 * 1000;

// Ten baseline local dates inside Oct 23 23:00 -> Nov 6 23:00.
const BASELINE_DAYS: Array<[number, number]> = [
  [10, 25],
  [10, 26],
  [10, 27],
  [10, 28],
  [10, 29],
  [10, 30],
  [10, 31],
  [11, 1],
  [11, 2],
  [11, 3],
];

const RECENT_DAYS: Array<[number, number]> = [
  [11, 7],
  [11, 8],
  [11, 9],
];

function iso(month: number, day: number, hour = 12, minute = 0): string {
  return new Date(2026, month - 1, day, hour, minute, 0, 0).toISOString();
}

function makeDog(overrides: Partial<Dog> = {}): Dog {
  return {
    dogId: "dog-1",
    dogName: "Riley",
    householdId: "household-1",
    dogImage: "",
    ...overrides,
  };
}

function event(
  id: string,
  type: CareEvent["type"],
  timestamp: string,
  overrides: Partial<CareEvent> = {},
): CareEvent {
  return {
    id,
    dogId: "dog-1",
    type,
    timestamp,
    userId: "user-1",
    ...overrides,
  };
}

function weightLog(
  id: string,
  timestamp: string,
  weight: number,
  dogId = "dog-1",
): WeightLog {
  return { id, dogId, weight, recordedAt: timestamp };
}

function forDays(
  days: Array<[number, number]>,
  build: (month: number, day: number, prefix: string) => CareEvent[],
): CareEvent[] {
  return days.flatMap(([month, day]) => build(month, day, `${month}-${day}`));
}

/** A balanced day: two feeds, one water event and one walk. */
function stableDay(
  month: number,
  day: number,
  prefix: string,
  includeFeed = true,
): CareEvent[] {
  const dayEvents = [
    event(`${prefix}-water`, "water", iso(month, day, 10)),
    event(`${prefix}-walk`, "walk", iso(month, day, 12)),
  ];

  if (includeFeed) {
    dayEvents.push(
      event(`${prefix}-feed-am`, "feed", iso(month, day, 8)),
      event(`${prefix}-feed-pm`, "feed", iso(month, day, 18)),
    );
  }

  return dayEvents;
}

function findInsight(
  report: ReturnType<typeof buildHealthBaseline>,
  id: string,
) {
  return report.insights.find((insight) => insight.id === id);
}

describe("buildHealthBaseline", () => {
  it("returns an insufficient logging insight when there is no data", () => {
    const report = buildHealthBaseline(makeDog(), [], [], NOW);

    expect(report.dataQuality).toBe("insufficient");
    expect(report.insights).toHaveLength(1);
    expect(report.insights[0]).toMatchObject({
      id: "logging-insufficient",
      kind: "logging",
      severity: "info",
      confidence: "low",
      direction: "stable",
    });
    expect(report.metrics.baselineActiveDays).toBe(0);
    expect(report.metrics.recentActiveDays).toBe(0);
    expect(report.metrics.baselineFeedsPerActiveDay).toBeNull();
    expect(report.metrics.recentFeedsPerActiveDay).toBeNull();
    expect(report.metrics.baselineWeightKg).toBeNull();
    expect(report.insights[0].detail).toMatch(
      /5 more baseline active days and 2 more recent active days/,
    );
    expect(report.insights[0].detail).toMatch(/not veterinary advice/i);
    expect(report.disclaimer).toBe(HEALTH_BASELINE_DISCLAIMER);
  });

  it("stays insufficient with fewer than five baseline active days", () => {
    const sparseBaseline: Array<[number, number]> = [
      [10, 30],
      [10, 31],
      [11, 1],
      [11, 2],
    ];
    const events = [
      ...forDays(sparseBaseline, stableDay),
      ...forDays(RECENT_DAYS, stableDay),
    ];

    const report = buildHealthBaseline(makeDog(), events, [], NOW);

    expect(report.dataQuality).toBe("insufficient");
    expect(report.insights).toHaveLength(1);
    expect(report.insights[0].id).toBe("logging-insufficient");
    expect(report.insights[0].detail).toContain("1 more baseline active day");
    expect(report.metrics.baselineActiveDays).toBe(4);
  });

  it("stays insufficient with fewer than two recent active days", () => {
    const events = [
      ...forDays(BASELINE_DAYS, stableDay),
      ...forDays([[11, 8]], stableDay),
    ];

    const report = buildHealthBaseline(makeDog(), events, [], NOW);

    expect(report.dataQuality).toBe("insufficient");
    expect(report.metrics.recentActiveDays).toBe(1);
    expect(report.insights[0].id).toBe("logging-insufficient");
    expect(report.insights[0].detail).toContain("1 more recent active day");
  });

  it("reports steady patterns when feed, water and walks are in line", () => {
    const events = [
      ...forDays(BASELINE_DAYS, stableDay),
      ...forDays(RECENT_DAYS, stableDay),
    ];

    const report = buildHealthBaseline(makeDog(), events, [], NOW);

    expect(report.dataQuality).toBe("good");
    expect(report.metrics.baselineActiveDays).toBe(10);
    expect(report.metrics.recentActiveDays).toBe(3);
    expect(report.metrics.baselineFeedsPerActiveDay).toBe(2);
    expect(report.metrics.recentFeedsPerActiveDay).toBe(2);
    expect(report.metrics.baselineWaterPerActiveDay).toBe(1);
    expect(report.metrics.recentWalksPerActiveDay).toBe(1);
    expect(report.insights).toHaveLength(1);
    expect(report.insights[0]).toMatchObject({
      id: "patterns-steady",
      kind: "logging",
      severity: "info",
      direction: "stable",
    });
    expect(report.insights[0].detail).toMatch(/not veterinary advice/i);
  });

  it("flags a large feeding drop as an attention insight", () => {
    const events = [
      ...forDays(BASELINE_DAYS, stableDay),
      ...forDays(RECENT_DAYS, (month, day, prefix) =>
        stableDay(month, day, prefix, false),
      ),
    ];

    const report = buildHealthBaseline(makeDog({ dogName: "Bear" }), events, [], NOW);
    const insight = findInsight(report, "feeding-intake-down");

    expect(insight).toBeDefined();
    expect(insight?.kind).toBe("feeding");
    expect(insight?.severity).toBe("attention");
    expect(insight?.direction).toBe("down");
    expect(insight?.detail).toContain("0 per active day");
    expect(insight?.detail).toContain("2 per active day");
    expect(insight?.detail).toMatch(/not veterinary advice/i);
    expect(insight?.recommendation).toMatch(/veterinarian/i);
  });

  it("flags a clear water increase as a watch insight", () => {
    const events = [
      ...forDays(BASELINE_DAYS, stableDay),
      ...forDays(RECENT_DAYS, (month, day, prefix) => [
        ...stableDay(month, day, prefix),
        event(`${prefix}-water-extra-am`, "water", iso(month, day, 14)),
        event(`${prefix}-water-extra-pm`, "water", iso(month, day, 20)),
      ]),
    ];

    const report = buildHealthBaseline(makeDog(), events, [], NOW);
    const insight = findInsight(report, "water-intake-up");

    expect(insight).toBeDefined();
    expect(insight?.kind).toBe("water");
    expect(insight?.severity).toBe("watch");
    expect(insight?.direction).toBe("up");
    expect(insight?.detail).toContain("3 per active day");
    expect(insight?.detail).toContain("1 per active day");
  });

  it("flags a large accident increase with attention", () => {
    const events: CareEvent[] = [];

    for (const [month, day] of BASELINE_DAYS) {
      events.push(event(`${month}-${day}-feed`, "feed", iso(month, day, 8)));
    }
    events.push(
      event("baseline-accident-1", "toilet", iso(10, 26, 14), {
        pottyOutcome: "accident",
      }),
      event("baseline-accident-2", "toilet", iso(10, 30, 14), {
        pottyOutcome: "accident",
      }),
    );

    for (const [month, day] of RECENT_DAYS) {
      events.push(
        event(`${month}-${day}-feed`, "feed", iso(month, day, 8)),
        event(`${month}-${day}-accident`, "toilet", iso(month, day, 14), {
          pottyOutcome: "accident",
        }),
      );
    }

    const report = buildHealthBaseline(makeDog({ dogName: "Bear" }), events, [], NOW);
    const insight = findInsight(report, "potty-accidents-up");

    expect(insight).toBeDefined();
    expect(insight?.kind).toBe("potty");
    expect(insight?.severity).toBe("attention");
    expect(insight?.direction).toBe("up");
    expect(insight?.detail).toMatch(/3 accidents/);
    expect(insight?.detail).toMatch(/0\.2 per active day/);
    expect(report.metrics.baselineAccidentsPerActiveDay).toBe(0.2);
    expect(report.metrics.recentAccidentsPerActiveDay).toBe(1);
  });

  it("flags a potty success-rate drop against the baseline", () => {
    const events: CareEvent[] = [];

    for (const [month, day] of BASELINE_DAYS) {
      events.push(
        event(`${month}-${day}-feed`, "feed", iso(month, day, 7)),
        event(`${month}-${day}-ok-1`, "toilet", iso(month, day, 8), {
          pottyOutcome: "success",
        }),
        event(`${month}-${day}-ok-2`, "toilet", iso(month, day, 12), {
          pottyOutcome: "success",
        }),
        event(`${month}-${day}-ok-3`, "toilet", iso(month, day, 16), {
          pottyOutcome: "success",
        }),
        event(`${month}-${day}-miss`, "toilet", iso(month, day, 20), {
          pottyOutcome: "accident",
        }),
      );
    }

    for (const [month, day] of RECENT_DAYS) {
      events.push(
        event(`${month}-${day}-feed`, "feed", iso(month, day, 7)),
        event(`${month}-${day}-ok`, "toilet", iso(month, day, 8), {
          pottyOutcome: "success",
        }),
        event(`${month}-${day}-miss-1`, "toilet", iso(month, day, 12), {
          pottyOutcome: "accident",
        }),
        event(`${month}-${day}-miss-2`, "toilet", iso(month, day, 16), {
          pottyOutcome: "accident",
        }),
      );
    }

    const report = buildHealthBaseline(makeDog(), events, [], NOW);
    const insight = findInsight(report, "potty-success-down");

    expect(report.metrics.baselinePottySuccessRate).toBe(0.75);
    expect(report.metrics.recentPottySuccessRate).toBeCloseTo(0.3333, 4);
    expect(insight).toBeDefined();
    expect(insight?.kind).toBe("potty");
    expect(insight?.severity).toBe("watch");
    expect(insight?.direction).toBe("down");
    expect(insight?.detail).toMatch(/75%/);
    expect(insight?.detail).toMatch(/33%/);
    // The accident increase here is exactly 2x, which stays below the alert
    // ratio, so this scenario isolates the success-rate rule.
    expect(findInsight(report, "potty-accidents-up")).toBeUndefined();
  });

  it("flags a large change in median toilet intervals neutrally", () => {
    const events: CareEvent[] = [];

    for (const [month, day] of BASELINE_DAYS) {
      events.push(event(`${month}-${day}-feed`, "feed", iso(month, day, 7)));
      for (const hour of [8, 10, 12, 14, 16]) {
        events.push(
          event(`${month}-${day}-toilet-${hour}`, "toilet", iso(month, day, hour)),
        );
      }
    }

    for (const [month, day] of RECENT_DAYS) {
      events.push(event(`${month}-${day}-feed`, "feed", iso(month, day, 7)));
      for (const hour of [8, 12, 16]) {
        events.push(
          event(`${month}-${day}-toilet-${hour}`, "toilet", iso(month, day, hour)),
        );
      }
    }

    const report = buildHealthBaseline(makeDog(), events, [], NOW);
    const insight = findInsight(report, "potty-interval-longer");

    expect(report.metrics.baselinePottyIntervalHours).toBe(2);
    expect(report.metrics.recentPottyIntervalHours).toBe(4);
    expect(insight).toBeDefined();
    expect(insight?.kind).toBe("potty");
    expect(insight?.severity).toBe("watch");
    expect(insight?.direction).toBe("up");
    expect(insight?.detail).toMatch(/4 hours/);
    expect(insight?.detail).toMatch(/2 hours/);
    expect(insight?.detail).toMatch(/fewer logged opportunities/i);
  });

  it("flags a weight change of ten percent or more", () => {
    const events = [
      ...forDays(BASELINE_DAYS, stableDay),
      ...forDays(RECENT_DAYS, stableDay),
    ];
    const weights = [
      weightLog("w-1", iso(10, 26, 10), 10),
      weightLog("w-2", iso(10, 29, 10), 10),
      weightLog("w-3", iso(11, 1, 10), 10),
      weightLog("w-4", iso(11, 3, 10), 10),
      weightLog("w-recent", iso(11, 8, 10), 11),
    ];

    const report = buildHealthBaseline(makeDog(), events, weights, NOW);
    const insight = findInsight(report, "weight-change-up");

    expect(report.metrics.baselineWeightKg).toBe(10);
    expect(report.metrics.latestWeightKg).toBe(11);
    expect(report.metrics.weightChangePct).toBe(10);
    expect(insight).toBeDefined();
    expect(insight?.kind).toBe("weight");
    expect(insight?.severity).toBe("watch");
    expect(insight?.direction).toBe("up");
    expect(insight?.detail).toMatch(/11 kg/);
    expect(insight?.detail).toMatch(/10 kg/);
  });

  it("does not alert for a small weight change below five percent", () => {
    const events = [
      ...forDays(BASELINE_DAYS, stableDay),
      ...forDays(RECENT_DAYS, stableDay),
    ];
    const weights = [
      weightLog("w-1", iso(10, 26, 10), 10),
      weightLog("w-2", iso(11, 3, 10), 10),
      weightLog("w-recent", iso(11, 8, 10), 10.2),
    ];

    const report = buildHealthBaseline(makeDog(), events, weights, NOW);

    expect(report.metrics.weightChangePct).toBe(2);
    expect(findInsight(report, "weight-change-up")).toBeUndefined();
    expect(report.insights.map((insight) => insight.id)).toEqual([
      "patterns-steady",
    ]);
  });

  it("ignores future events and events for other dogs", () => {
    const events = [
      event("future-feed", "feed", new Date(NOW.getTime() + DAY_MS).toISOString()),
      event("other-today", "feed", iso(11, 9, 10), { dogId: "dog-2" }),
      event("other-baseline", "walk", iso(10, 30, 10), { dogId: "dog-2" }),
    ];
    const weights = [weightLog("other-weight", iso(11, 8, 10), 8, "dog-2")];

    const report = buildHealthBaseline(makeDog(), events, weights, NOW);

    expect(report.dataQuality).toBe("insufficient");
    expect(report.metrics.baselineActiveDays).toBe(0);
    expect(report.metrics.recentActiveDays).toBe(0);
    expect(report.metrics.latestWeightKg).toBeNull();
    expect(report.insights[0].id).toBe("logging-insufficient");
  });

  it("excludes the recent window from the baseline", () => {
    const fiveBaselineDays: Array<[number, number]> = [
      [10, 30],
      [10, 31],
      [11, 1],
      [11, 2],
      [11, 3],
    ];
    const boundary = new Date(NOW.getTime() - 3 * DAY_MS).toISOString();
    const events = [
      ...fiveBaselineDays.map(([month, day]) =>
        event(`${month}-${day}-feed`, "feed", iso(month, day, 8)),
      ),
      event("boundary-feed", "feed", boundary),
      ...Array.from({ length: 10 }, (_, index) =>
        event(`recent-7-${index}`, "feed", iso(11, 7, 8, index)),
      ),
      ...Array.from({ length: 10 }, (_, index) =>
        event(`recent-8-${index}`, "feed", iso(11, 8, 8, index)),
      ),
    ];

    const report = buildHealthBaseline(makeDog(), events, [], NOW);

    expect(report.window.recentStart).toBe(boundary);
    expect(report.window.baselineEnd).toBe(boundary);
    expect(report.metrics.baselineActiveDays).toBe(5);
    expect(report.metrics.recentActiveDays).toBe(3);
    // The 21 recent/boundary feeds must not leak into the baseline rate.
    expect(report.metrics.baselineFeedsPerActiveDay).toBe(1);
    expect(report.metrics.recentFeedsPerActiveDay).toBe(7);
  });

  it("caps ordinary insights at four and sorts by severity", () => {
    const events: CareEvent[] = [];
    const weights: WeightLog[] = [];

    for (const [month, day] of BASELINE_DAYS) {
      events.push(
        event(`${month}-${day}-feed-am`, "feed", iso(month, day, 8)),
        event(`${month}-${day}-feed-pm`, "feed", iso(month, day, 18)),
        event(`${month}-${day}-water`, "water", iso(month, day, 10)),
        event(`${month}-${day}-walk-am`, "walk", iso(month, day, 9)),
        event(`${month}-${day}-walk-pm`, "walk", iso(month, day, 16)),
        event(`${month}-${day}-success`, "toilet", iso(month, day, 8), {
          pottyOutcome: "success",
        }),
      );
    }
    events.push(
      event("baseline-accident-1", "toilet", iso(10, 26, 14), {
        pottyOutcome: "accident",
      }),
      event("baseline-accident-2", "toilet", iso(10, 30, 14), {
        pottyOutcome: "accident",
      }),
    );
    weights.push(
      weightLog("w-1", iso(10, 26, 10), 10),
      weightLog("w-2", iso(10, 29, 10), 10),
      weightLog("w-3", iso(11, 1, 10), 10),
      weightLog("w-4", iso(11, 3, 10), 10),
    );

    for (const [month, day] of RECENT_DAYS) {
      events.push(
        event(`${month}-${day}-water-1`, "water", iso(month, day, 8)),
        event(`${month}-${day}-water-2`, "water", iso(month, day, 12)),
        event(`${month}-${day}-water-3`, "water", iso(month, day, 18)),
        event(`${month}-${day}-success`, "toilet", iso(month, day, 8), {
          pottyOutcome: "success",
        }),
        event(`${month}-${day}-accident-1`, "toilet", iso(month, day, 10), {
          pottyOutcome: "accident",
        }),
        event(`${month}-${day}-accident-2`, "toilet", iso(month, day, 16), {
          pottyOutcome: "accident",
        }),
      );
    }
    weights.push(weightLog("w-recent", iso(11, 8, 10), 12));

    const report = buildHealthBaseline(makeDog(), events, weights, NOW);
    const severityRank = { info: 0, watch: 1, attention: 2 } as const;
    const ranks = report.insights.map(
      (insight) => severityRank[insight.severity],
    );

    expect(report.insights).toHaveLength(4);
    expect(ranks).toEqual([...ranks].sort((left, right) => right - left));
    expect(
      report.insights.filter((insight) => insight.severity === "attention")
        .length,
    ).toBeGreaterThanOrEqual(2);
    expect(new Set(report.insights.map((insight) => insight.id)).size).toBe(4);
  });

  it("caps insight confidence when the supporting data is sparse", () => {
    const events = [
      ...forDays(BASELINE_DAYS, stableDay),
      ...forDays(RECENT_DAYS, stableDay),
    ];
    // Plenty of events for high base confidence, but only four baseline
    // weigh-ins and a single recent weigh-in.
    const weights = [
      weightLog("w-1", iso(10, 26, 10), 10),
      weightLog("w-2", iso(10, 29, 10), 10),
      weightLog("w-3", iso(11, 1, 10), 10),
      weightLog("w-4", iso(11, 3, 10), 10),
      weightLog("w-recent", iso(11, 8, 10), 11),
    ];

    const report = buildHealthBaseline(makeDog(), events, weights, NOW);
    const insight = findInsight(report, "weight-change-up");

    expect(report.dataQuality).toBe("good");
    expect(insight).toBeDefined();
    expect(insight?.confidence).toBe("low");
  });

  it("formats an insight for export with its current and baseline values", () => {
    const events = [
      ...forDays(BASELINE_DAYS, stableDay),
      ...forDays(RECENT_DAYS, stableDay),
    ];
    const report = buildHealthBaseline(makeDog(), events, [], NOW);
    const text = formatHealthInsightForExport(report.insights[0]);

    expect(text).toContain(report.insights[0].title);
    expect(text).toContain(report.insights[0].detail);
    expect(text).toContain("Current:");
    expect(text).toContain("Baseline:");
    expect(text).toContain("Next step:");
  });
});
