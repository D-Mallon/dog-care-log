import { describe, expect, it } from "vitest";
import type { CareEvent, Dog, WeightLog } from "../../types/core.ts";
import { buildAccountExportCsv } from "../accountExport.ts";

const dogA: Dog = {
  dogId: "dog-a",
  dogName: "Bear, K",
  householdId: "house-1",
  dogImage: "",
};

const dogB: Dog = {
  dogId: "dog-b",
  dogName: "Ada",
  householdId: "house-1",
  dogImage: "",
};

const events: CareEvent[] = [
  {
    id: "event-1",
    dogId: "dog-a",
    type: "feed",
    timestamp: "2026-11-08T08:00:00Z",
    userId: "user-1",
    note: 'Ate "everything"',
  },
  {
    id: "event-2",
    dogId: "dog-b",
    type: "walk",
    timestamp: "2026-11-08T09:00:00Z",
    userId: "user-2",
    note: "Park",
  },
];

const weights: WeightLog[] = [
  {
    id: "weight-1",
    dogId: "dog-a",
    weight: 28.5,
    recordedAt: "2026-11-08T07:00:00Z",
    userId: "user-1",
  },
];

describe("household export", () => {
  it("includes every dog, event and weight in one CSV", () => {
    const csv = buildAccountExportCsv([dogA, dogB], events, weights, {
      feed: "Fed",
      walk: "Walked",
    });

    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain('"Bear, K"');
    expect(csv).toContain("Ada");
    expect(csv).toContain("Fed");
    expect(csv).toContain("Walked");
    expect(csv).toContain("28.5");
    expect(csv).toContain('"Ate ""everything"""');
  });

  it("does not leak events for a dog outside the supplied list", () => {
    const csv = buildAccountExportCsv([dogA], events, weights, {
      feed: "Fed",
      walk: "Walked",
    });

    expect(csv).toContain("Bear, K");
    expect(csv).not.toContain("Park");
  });
});
