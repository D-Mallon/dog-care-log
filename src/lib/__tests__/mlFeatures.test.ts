import { describe, expect, it } from "vitest";
import type { CareEvent, Dog, EventType, WeightLog } from "../../types/core.ts";
import type { FeatureValue } from "../mlFeatures.ts";
import {
  buildDogFeatureSnapshot,
  ML_FEATURE_VERSION,
} from "../mlFeatures.ts";

const DAY_MS = 24 * 60 * 60 * 1000;

// Late evening on Monday 9 November 2026, so same-day test events up to
// 23:00 are in the past. Local constructors keep the tests portable across
// time zones and daylight-saving changes.
const NOW = new Date(2026, 10, 9, 23, 30, 0);

/** Local timestamp `daysAgo` days before NOW at the given wall-clock hour. */
function isoAt(daysAgo: number, hour: number, minute = 0): string {
  return new Date(
    NOW.getFullYear(),
    NOW.getMonth(),
    NOW.getDate() - daysAgo,
    hour,
    minute,
  ).toISOString();
}

function makeDog(overrides: Partial<Dog> = {}): Dog {
  return {
    dogId: "dog-1",
    dogName: "Bella",
    householdId: "household-1",
    dogImage: "",
    ...overrides,
  };
}

function makeEvent(
  id: string,
  type: EventType,
  timestamp: string,
  extra: Partial<CareEvent> = {},
  dogId = "dog-1",
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
  weight: number,
  timestamp: string,
  dogId = "dog-1",
): WeightLog {
  return { id, dogId, weight, recordedAt: timestamp };
}

function snapshot(
  dog: Dog,
  events: CareEvent[] = [],
  weights: WeightLog[] = [],
  windowDays: 7 | 14 | 28 = 14,
) {
  return buildDogFeatureSnapshot(dog, events, weights, NOW, windowDays);
}

function numeric(
  features: Record<string, FeatureValue>,
  key: string,
): number {
  const value = features[key];
  if (typeof value !== "number") {
    throw new Error(`Expected numeric feature "${key}", received ${String(value)}`);
  }
  return value;
}

describe("ML_FEATURE_VERSION", () => {
  it("is exposed on every snapshot", () => {
    const snap = snapshot(makeDog());
    expect(ML_FEATURE_VERSION).toBe(1);
    expect(snap.version).toBe(ML_FEATURE_VERSION);
  });
});

describe("buildDogFeatureSnapshot", () => {
  it("returns nulls, zeros and no NaN for empty data", () => {
    const snap = snapshot(makeDog());

    expect(snap.dogId).toBe("dog-1");
    expect(snap.generatedAt).toBe(NOW.toISOString());
    expect(snap.windowDays).toBe(14);

    const features = snap.features;
    expect(features.breed_id).toBeNull();
    expect(features.sex).toBeNull();
    expect(features.neutered).toBeNull();
    expect(features.age_days).toBeNull();
    expect(features.size_category).toBeNull();
    expect(features.activity_level).toBeNull();
    expect(features.training_stage).toBeNull();
    expect(features.current_weight_kg).toBeNull();
    expect(features.adult_weight_kg).toBeNull();

    expect(features.window_days).toBe(14);
    expect(features.observed_days).toBe(14);
    expect(features.active_logging_days).toBe(0);
    expect(features.event_count).toBe(0);

    for (const key of [
      "feeds_per_active_day",
      "water_per_active_day",
      "walks_per_active_day",
      "toilets_per_active_day",
      "accidents_per_active_day",
      "meds_per_active_day",
      "play_per_active_day",
    ]) {
      expect(features[key]).toBeNull();
    }

    expect(features.potty_success_count).toBe(0);
    expect(features.potty_accident_count).toBe(0);
    expect(features.potty_classified_count).toBe(0);
    expect(features.potty_success_rate).toBeNull();
    expect(features.median_potty_interval_hours).toBeNull();
    expect(features.night_potty_count).toBe(0);
    expect(features.accident_rate_per_toilet).toBeNull();

    expect(features.morning_event_share).toBeNull();
    expect(features.evening_event_share).toBeNull();
    expect(features.weekend_event_share).toBeNull();

    expect(features.weight_log_count).toBe(0);
    expect(features.weight_start_kg).toBeNull();
    expect(features.weight_end_kg).toBeNull();
    expect(features.weight_change_kg).toBeNull();
    expect(features.weight_change_pct).toBeNull();

    expect(features.feed_days).toBe(0);
    expect(features.walk_days).toBe(0);
    expect(features.toilet_days).toBe(0);
    expect(features.care_days).toBe(0);

    for (const value of Object.values(features)) {
      if (typeof value === "number") {
        expect(Number.isFinite(value)).toBe(true);
      }
    }

    expect(Object.keys(features).sort()).toEqual(
      [
        "adult_weight_kg",
        "accident_rate_per_toilet",
        "accidents_per_active_day",
        "active_logging_days",
        "activity_level",
        "age_days",
        "breed_id",
        "care_days",
        "current_weight_kg",
        "evening_event_share",
        "event_count",
        "feed_days",
        "feeds_per_active_day",
        "meds_per_active_day",
        "median_potty_interval_hours",
        "morning_event_share",
        "neutered",
        "night_potty_count",
        "observed_days",
        "play_per_active_day",
        "potty_accident_count",
        "potty_classified_count",
        "potty_success_count",
        "potty_success_rate",
        "sex",
        "size_category",
        "toilet_days",
        "toilets_per_active_day",
        "training_stage",
        "walk_days",
        "walks_per_active_day",
        "water_per_active_day",
        "weekend_event_share",
        "weight_change_kg",
        "weight_change_pct",
        "weight_end_kg",
        "weight_log_count",
        "weight_start_kg",
        "window_days",
      ].sort(),
    );
  });

  it("builds profile features, deriving age from date of birth", () => {
    const dateOfBirth = isoAt(60, 12);
    const dog = makeDog({
      breedId: "labrador-retriever",
      sex: "female",
      neutered: false,
      dateOfBirth,
      age: 9,
      sizeCategory: "large",
      activityLevel: "high",
      trainingStage: "adult",
      weight: 22,
      adultWeightKg: 30,
    });
    const weights = [
      makeWeight("w-old", 20, isoAt(40, 12)),
      makeWeight("w-new", 21.5, isoAt(2, 12)),
    ];

    const features = snapshot(dog, [], weights).features;
    const expectedAgeDays =
      Math.round(
        ((NOW.getTime() - new Date(dateOfBirth).getTime()) / DAY_MS) * 10_000,
      ) / 10_000;

    expect(features.breed_id).toBe("labrador-retriever");
    expect(features.sex).toBe("female");
    expect(features.neutered).toBe(false);
    expect(numeric(features, "age_days")).toBe(expectedAgeDays);
    expect(numeric(features, "age_days")).toBeGreaterThan(59);
    expect(numeric(features, "age_days")).toBeLessThan(61);
    expect(features.size_category).toBe("large");
    expect(features.activity_level).toBe("high");
    expect(features.training_stage).toBe("adult");
    // Latest weigh-in (even outside the window) is the current weight.
    expect(features.current_weight_kg).toBe(21.5);
    expect(features.adult_weight_kg).toBe(30);
    expect(features.weight_log_count).toBe(1);
  });

  it("falls back to age years and dog.weight when profile data is sparse", () => {
    const features = snapshot(makeDog({ age: 2, weight: 22 })).features;

    expect(features.age_days).toBe(730.5);
    expect(features.current_weight_kg).toBe(22);
    expect(features.neutered).toBeNull();
    expect(features.breed_id).toBeNull();
  });

  it("computes per-active-day rates", () => {
    const events = [
      makeEvent("e1", "feed", isoAt(0, 8)),
      makeEvent("e2", "water", isoAt(0, 9)),
      makeEvent("e3", "walk", isoAt(0, 10)),
      makeEvent("e4", "toilet", isoAt(0, 11)),
      makeEvent("e5", "meds", isoAt(0, 12)),
      makeEvent("e6", "play_time", isoAt(0, 13)),
      makeEvent("e7", "feed", isoAt(1, 8)),
      makeEvent("e8", "walk", isoAt(1, 17)),
      makeEvent("e9", "toilet", isoAt(1, 19)),
    ];

    const features = snapshot(makeDog(), events).features;

    expect(features.event_count).toBe(9);
    expect(features.active_logging_days).toBe(2);
    expect(features.feeds_per_active_day).toBe(1);
    expect(features.water_per_active_day).toBe(0.5);
    expect(features.walks_per_active_day).toBe(1);
    expect(features.toilets_per_active_day).toBe(1);
    expect(features.accidents_per_active_day).toBe(0);
    expect(features.meds_per_active_day).toBe(0.5);
    expect(features.play_per_active_day).toBe(0.5);
  });

  it("counts potty successes and accidents, with pottyOutcome taking precedence", () => {
    const events = [
      makeEvent("t1", "toilet", isoAt(0, 6), {
        pottyOutcome: "success",
        isAccident: true,
      }),
      makeEvent("t2", "toilet", isoAt(0, 9), {
        pottyOutcome: "accident",
        isAccident: false,
      }),
      makeEvent("t3", "toilet", isoAt(0, 12), { isAccident: false }),
      makeEvent("t4", "toilet", isoAt(0, 15), {
        pottyOutcome: "accident",
        subtype: "poo",
      }),
      makeEvent("t5", "toilet", isoAt(0, 18), { isAccident: true }),
    ];

    const features = snapshot(makeDog(), events).features;

    expect(features.potty_success_count).toBe(2);
    expect(features.potty_accident_count).toBe(3);
    expect(features.potty_classified_count).toBe(5);
    expect(features.potty_success_rate).toBe(0.4);
    expect(features.accident_rate_per_toilet).toBe(0.6);
    expect(features.toilet_days).toBe(1);
  });

  it("leaves unclassified toilet events out of the success rate", () => {
    const events = [
      makeEvent("u1", "toilet", isoAt(0, 8)),
      makeEvent("u2", "toilet", isoAt(0, 9)),
    ];

    const features = snapshot(makeDog(), events).features;

    expect(features.potty_success_count).toBe(0);
    expect(features.potty_accident_count).toBe(0);
    expect(features.potty_classified_count).toBe(0);
    expect(features.potty_success_rate).toBeNull();
    expect(features.accident_rate_per_toilet).toBe(0);
    // No structured outcomes, so every toilet event anchors an interval.
    expect(features.median_potty_interval_hours).toBe(1);
  });

  it("uses successful pees for median intervals when outcomes are structured", () => {
    const events = [
      makeEvent("p1", "toilet", isoAt(0, 6), {
        pottyOutcome: "success",
        subtype: "pee",
      }),
      makeEvent("p2", "toilet", isoAt(0, 7), {
        pottyOutcome: "success",
        subtype: "poo",
      }),
      makeEvent("p3", "toilet", isoAt(0, 8), {
        pottyOutcome: "success",
        subtype: "pee",
      }),
      makeEvent("p4", "toilet", isoAt(0, 9), { pottyOutcome: "accident" }),
      makeEvent("p5", "toilet", isoAt(0, 10), {
        pottyOutcome: "success",
        subtype: "pee",
      }),
    ];

    const features = snapshot(makeDog({ age: 3 }), events).features;

    // 06:00 → 08:00 and 08:00 → 10:00; the poo and the accident are ignored.
    expect(features.median_potty_interval_hours).toBe(2);
  });

  it("falls back to all toilet events when no structured outcomes exist", () => {
    const events = [
      makeEvent("l1", "toilet", isoAt(0, 6)),
      makeEvent("l2", "toilet", isoAt(0, 7)),
      makeEvent("l3", "toilet", isoAt(0, 9)),
    ];

    const features = snapshot(makeDog({ age: 3 }), events).features;

    expect(features.median_potty_interval_hours).toBe(1.5);
  });

  it("applies puppy and adult interval bounds", () => {
    const events = [
      makeEvent("i1", "toilet", isoAt(0, 6)),
      makeEvent("i2", "toilet", isoAt(0, 19)),
    ];
    const puppy = snapshot(makeDog({ dateOfBirth: isoAt(90, 12) }), events);
    const adult = snapshot(makeDog({ age: 3 }), events);

    // 13 hours is too long for a puppy under six months.
    expect(puppy.features.median_potty_interval_hours).toBeNull();
    expect(adult.features.median_potty_interval_hours).toBe(13);

    const boundaryEvents = [
      makeEvent("b1", "toilet", isoAt(2, 8)),
      makeEvent("b2", "toilet", isoAt(0, 8)),
      makeEvent("b3", "toilet", isoAt(0, 8, 10)),
      makeEvent("b4", "toilet", isoAt(0, 10)),
    ];
    const boundary = snapshot(makeDog({ age: 3 }), boundaryEvents).features;

    // 48h and 10m gaps are ignored; only the 110m gap remains.
    expect(boundary.median_potty_interval_hours).toBe(1.8333);
  });

  it("counts night potty events and time-of-day/weekend shares", () => {
    const events = [
      makeEvent("s1", "play_time", isoAt(2, 10)), // Saturday morning
      makeEvent("s2", "toilet", isoAt(1, 23)), // Sunday night
      makeEvent("s3", "toilet", isoAt(0, 2)), // Monday night
      makeEvent("s4", "feed", isoAt(0, 9)), // Monday morning
      makeEvent("s5", "walk", isoAt(0, 19)), // Monday evening
    ];

    const features = snapshot(makeDog(), events).features;

    expect(features.night_potty_count).toBe(2);
    expect(features.event_count).toBe(5);
    expect(features.morning_event_share).toBe(0.4);
    expect(features.evening_event_share).toBe(0.4);
    expect(features.weekend_event_share).toBe(0.4);
  });

  it("computes weight trend inside the window", () => {
    const dog = makeDog();
    const weights = [
      makeWeight("w1", 20, isoAt(10, 12)),
      makeWeight("w2", 21, isoAt(5, 12)),
      makeWeight("w3", 22.5, isoAt(1, 12)),
    ];

    const features = snapshot(dog, [], weights).features;
    expect(features.weight_log_count).toBe(3);
    expect(features.weight_start_kg).toBe(20);
    expect(features.weight_end_kg).toBe(22.5);
    expect(features.weight_change_kg).toBe(2.5);
    expect(features.weight_change_pct).toBe(12.5);

    const single = snapshot(dog, [], [weights[2]]).features;
    expect(single.weight_log_count).toBe(1);
    expect(single.weight_start_kg).toBe(22.5);
    expect(single.weight_end_kg).toBe(22.5);
    expect(single.weight_change_kg).toBeNull();
    expect(single.weight_change_pct).toBeNull();

    // A weigh-in before the window still supplies the current weight.
    const oldOnly = snapshot(dog, [], [makeWeight("w0", 19, isoAt(40, 12))]);
    expect(oldOnly.features.weight_log_count).toBe(0);
    expect(oldOnly.features.weight_start_kg).toBeNull();
    expect(oldOnly.features.current_weight_kg).toBe(19);
  });

  it("supports 7, 14 and 28 day windows", () => {
    const events = [
      makeEvent("win1", "feed", isoAt(10, 12)),
      makeEvent("win2", "feed", isoAt(0, 12)),
    ];
    const weights = [makeWeight("win-w", 21, isoAt(10, 12))];

    const seven = snapshot(makeDog(), events, weights, 7);
    const fourteen = snapshot(makeDog(), events, weights, 14);
    const twentyEight = snapshot(makeDog(), events, weights, 28);

    expect(seven.windowDays).toBe(7);
    expect(seven.features.window_days).toBe(7);
    expect(seven.features.observed_days).toBe(7);
    expect(seven.features.event_count).toBe(1);
    expect(seven.features.weight_log_count).toBe(0);

    expect(fourteen.features.event_count).toBe(2);
    expect(fourteen.features.weight_log_count).toBe(1);

    expect(twentyEight.windowDays).toBe(28);
    expect(twentyEight.features.window_days).toBe(28);
    expect(twentyEight.features.observed_days).toBe(28);
    expect(twentyEight.features.event_count).toBe(2);
    expect(twentyEight.features.weight_log_count).toBe(1);
  });

  it("ignores other dogs, future timestamps and unusable dates", () => {
    const dog = makeDog();
    const events = [
      makeEvent("own-1", "feed", isoAt(1, 12)),
      makeEvent("own-2", "toilet", isoAt(0, 12)),
      makeEvent("other", "feed", isoAt(0, 12), {}, "dog-2"),
      makeEvent("future", "feed", isoAt(-1, 12)),
      makeEvent("bad", "feed", "not-a-date"),
    ];
    const weights = [
      makeWeight("own-w", 20, isoAt(1, 12)),
      makeWeight("other-w", 30, isoAt(0, 12), "dog-2"),
      makeWeight("future-w", 25, isoAt(-1, 12)),
    ];

    const features = snapshot(dog, events, weights).features;

    expect(features.event_count).toBe(2);
    expect(features.active_logging_days).toBe(2);
    expect(features.feed_days).toBe(1);
    expect(features.toilet_days).toBe(1);
    expect(features.weight_log_count).toBe(1);
    expect(features.weight_end_kg).toBe(20);
    expect(features.current_weight_kg).toBe(20);
  });

  it("rounds numeric features to four decimals and never emits NaN", () => {
    const events = [
      makeEvent("r1", "feed", isoAt(2, 12)),
      makeEvent("r2", "feed", isoAt(1, 12)),
      makeEvent("r3", "water", isoAt(0, 12)),
    ];
    const weights = [
      makeWeight("rw1", 3, isoAt(4, 12)),
      makeWeight("rw2", 3.1, isoAt(0, 12)),
    ];

    const features = snapshot(makeDog(), events, weights).features;

    // Two feeds across three active days.
    expect(features.feeds_per_active_day).toBe(0.6667);
    expect(features.weight_change_pct).toBe(3.3333);

    for (const value of Object.values(features)) {
      if (typeof value === "number") {
        expect(Number.isFinite(value)).toBe(true);
        expect(Math.round(value * 10_000) / 10_000).toBe(value);
      }
    }
  });

  it("does not expose names, household ids, user ids, notes, images or emails", () => {
    const dog = makeDog({
      dogName: "Bella Secret",
      householdId: "household-secret",
      notes: "owner secret note",
      medicalNotes: "medical secret",
      dogImage: "data:image/png;base64,secret",
    });
    const events = [
      makeEvent("pii-1", "toilet", isoAt(0, 12), {
        note: "owner said secret",
        userId: "user-secret",
      }),
    ];

    const json = JSON.stringify(snapshot(dog, events).features);

    for (const forbidden of [
      "Bella Secret",
      "household-secret",
      "owner secret note",
      "medical secret",
      "data:image/png",
      "owner said secret",
      "user-secret",
    ]) {
      expect(json).not.toContain(forbidden);
    }
  });
});
