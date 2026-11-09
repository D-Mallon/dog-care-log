import type {
  CareEvent,
  Dog,
  PottyOutcome,
  WeightLog,
} from "../types/core.ts";

const DAYS_IN_WEEK = 7;

/**
 * Shown alongside every report. The report is descriptive only: it never
 * attempts to diagnose or rule out a health problem.
 */
export const WEEKLY_REPORT_DISCLAIMER =
  "These are general observations based on the care events logged in this household. They are not veterinary advice. If you have concerns about a dog's health, contact your veterinarian.";

/** Every highlight and concern is prefixed so it cannot read as a diagnosis. */
export const GENERAL_OBSERVATION_PREFIX =
  "General observation (not veterinary advice): ";

export interface WeekWindow {
  /** ISO timestamp for local midnight at the start of the seven-day window. */
  start: string;
  /** ISO timestamp for the report's end (the supplied `now`). */
  end: string;
  /** Number of local calendar days covered by the window. */
  days: number;
}

export interface WeekConsistency {
  /** Days with at least one feed event. */
  feedDays: number;
  /** Days with at least one walk event. */
  walkDays: number;
  /** Days with at least one feed or walk event. */
  careDays: number;
  /** Total local calendar days in the window. */
  daysInWindow: number;
  /** Longest run of consecutive days with a feed or walk. */
  longestCareStreak: number;
}

export interface WeightTrend {
  startWeight: number;
  endWeight: number;
  /** End weight minus start weight, in kilograms. */
  change: number;
  logCount: number;
}

export interface DogWeekSummary {
  dogId: string;
  dogName: string;
  dogImage: string;
  eventCount: number;
  feedCount: number;
  walkCount: number;
  toiletCount: number;
  pottySuccessCount: number;
  pottyAccidentCount: number;
  /** 0–1, or null when no toilet events have a usable outcome. */
  pottySuccessRate: number | null;
  activeDayCount: number;
  averageEventsPerActiveDay: number;
  consistency: WeekConsistency;
  /** Null unless there are at least two weigh-ins in the window. */
  weight: WeightTrend | null;
  weightLogCount: number;
}

export interface HouseholdWeekSummary {
  dogCount: number;
  eventCount: number;
  feedCount: number;
  walkCount: number;
  toiletCount: number;
  pottySuccessCount: number;
  pottyAccidentCount: number;
  /** 0–1, or null when no toilet events have a usable outcome. */
  pottySuccessRate: number | null;
  activeDayCount: number;
  averageEventsPerActiveDay: number;
  consistency: WeekConsistency;
  weightLogCount: number;
  /** Dogs with at least two weigh-ins, i.e. an available weight change. */
  dogsWithWeightTrend: number;
}

export interface WeeklyReport {
  window: WeekWindow;
  generatedAt: string;
  household: HouseholdWeekSummary;
  dogs: DogWeekSummary[];
  highlights: string[];
  concerns: string[];
  disclaimer: string;
}

type WindowEvent = {
  event: CareEvent;
  timestamp: number;
  dayKey: string;
};

type WindowWeightLog = {
  log: WeightLog;
  timestamp: number;
};

function roundTo(value: number, decimalPlaces: number): number {
  const factor = 10 ** decimalPlaces;
  return Math.round(value * factor) / factor;
}

function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function localDayKeys(firstDay: Date, count: number): string[] {
  const keys: string[] = [];
  for (let index = 0; index < count; index += 1) {
    keys.push(
      localDateKey(
        new Date(
          firstDay.getFullYear(),
          firstDay.getMonth(),
          firstDay.getDate() + index,
        ),
      ),
    );
  }
  return keys;
}

function parseTimestamp(value: string): number | null {
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function classifyPotty(event: CareEvent): PottyOutcome | null {
  if (event.pottyOutcome === "success" || event.pottyOutcome === "accident") {
    return event.pottyOutcome;
  }
  if (event.isAccident === true) return "accident";
  if (event.isAccident === false) return "success";
  return null;
}

function countPotty(events: WindowEvent[]): {
  successes: number;
  accidents: number;
} {
  let successes = 0;
  let accidents = 0;

  for (const { event } of events) {
    const outcome = classifyPotty(event);
    if (outcome === "success") successes += 1;
    if (outcome === "accident") accidents += 1;
  }

  return { successes, accidents };
}

function longestConsecutiveRun(
  dayKeys: string[],
  activeDayKeys: Set<string>,
): number {
  let longest = 0;
  let current = 0;

  for (const dayKey of dayKeys) {
    if (activeDayKeys.has(dayKey)) {
      current += 1;
      longest = Math.max(longest, current);
    } else {
      current = 0;
    }
  }

  return longest;
}

function buildConsistency(
  events: WindowEvent[],
  dayKeys: string[],
): WeekConsistency {
  const feedDays = new Set<string>();
  const walkDays = new Set<string>();

  for (const { event, dayKey } of events) {
    if (event.type === "feed") feedDays.add(dayKey);
    if (event.type === "walk") walkDays.add(dayKey);
  }

  const careDays = new Set<string>([...feedDays, ...walkDays]);

  return {
    feedDays: feedDays.size,
    walkDays: walkDays.size,
    careDays: careDays.size,
    daysInWindow: DAYS_IN_WEEK,
    longestCareStreak: longestConsecutiveRun(dayKeys, careDays),
  };
}

function buildWeightTrend(weights: WindowWeightLog[]): WeightTrend | null {
  if (weights.length < 2) return null;

  const sorted = [...weights].sort(
    (left, right) =>
      left.timestamp - right.timestamp ||
      left.log.id.localeCompare(right.log.id),
  );
  const startWeight = sorted[0].log.weight;
  const endWeight = sorted[sorted.length - 1].log.weight;

  return {
    startWeight,
    endWeight,
    change: roundTo(endWeight - startWeight, 2),
    logCount: sorted.length,
  };
}

function buildDogSummary(
  dog: Dog,
  events: WindowEvent[],
  weights: WindowWeightLog[],
  dayKeys: string[],
): DogWeekSummary {
  const activeDays = new Set(events.map(({ dayKey }) => dayKey));
  const feedCount = events.filter(({ event }) => event.type === "feed").length;
  const walkCount = events.filter(({ event }) => event.type === "walk").length;
  const toiletEvents = events.filter(({ event }) => event.type === "toilet");
  const { successes, accidents } = countPotty(toiletEvents);
  const classified = successes + accidents;
  const weight = buildWeightTrend(weights);

  return {
    dogId: dog.dogId,
    dogName: dog.dogName,
    dogImage: dog.dogImage,
    eventCount: events.length,
    feedCount,
    walkCount,
    toiletCount: toiletEvents.length,
    pottySuccessCount: successes,
    pottyAccidentCount: accidents,
    pottySuccessRate:
      classified > 0 ? roundTo(successes / classified, 4) : null,
    activeDayCount: activeDays.size,
    averageEventsPerActiveDay:
      activeDays.size > 0
        ? roundTo(events.length / activeDays.size, 1)
        : 0,
    consistency: buildConsistency(events, dayKeys),
    weight,
    weightLogCount: weights.length,
  };
}

function buildHouseholdSummary(
  dogs: Dog[],
  events: WindowEvent[],
  weightsByDog: Map<string, WindowWeightLog[]>,
  dayKeys: string[],
): HouseholdWeekSummary {
  const activeDays = new Set(events.map(({ dayKey }) => dayKey));
  const toiletEvents = events.filter(({ event }) => event.type === "toilet");
  const { successes, accidents } = countPotty(toiletEvents);
  const classified = successes + accidents;
  const weightLogCount = [...weightsByDog.values()].reduce(
    (total, weights) => total + weights.length,
    0,
  );

  let feedCount = 0;
  let walkCount = 0;

  for (const { event } of events) {
    if (event.type === "feed") feedCount += 1;
    if (event.type === "walk") walkCount += 1;
  }

  return {
    dogCount: dogs.length,
    eventCount: events.length,
    feedCount,
    walkCount,
    toiletCount: toiletEvents.length,
    pottySuccessCount: successes,
    pottyAccidentCount: accidents,
    pottySuccessRate:
      classified > 0 ? roundTo(successes / classified, 4) : null,
    activeDayCount: activeDays.size,
    averageEventsPerActiveDay:
      activeDays.size > 0
        ? roundTo(events.length / activeDays.size, 1)
        : 0,
    consistency: buildConsistency(events, dayKeys),
    weightLogCount,
    dogsWithWeightTrend: [...weightsByDog.values()].filter(
      (weights) => weights.length >= 2,
    ).length,
  };
}

function pluralize(
  count: number,
  singular: string,
  pluralForm = `${singular}s`,
): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

function buildObservations(
  dogs: DogWeekSummary[],
  household: HouseholdWeekSummary,
): { highlights: string[]; concerns: string[] } {
  const highlights: string[] = [];
  const concerns: string[] = [];
  const observe = (text: string) => `${GENERAL_OBSERVATION_PREFIX}${text}`;

  if (dogs.length === 0) {
    concerns.push(
      observe(
        "No dogs are set up in this household yet, so there is no weekly data to summarise.",
      ),
    );
    return { highlights, concerns };
  }

  if (household.eventCount === 0) {
    concerns.push(
      observe(
        "No care events were logged in this seven-day window, so the report has no activity to summarise yet.",
      ),
    );
    for (const dog of dogs) {
      concerns.push(
        observe(`${dog.dogName} had no care events logged in this window.`),
      );
    }
  } else {
    highlights.push(
      observe(
        `${pluralize(household.eventCount, "care event")} logged on ${household.activeDayCount} of ${DAYS_IN_WEEK} days.`,
      ),
    );

    if (household.activeDayCount === DAYS_IN_WEEK) {
      highlights.push(
        observe("Care events were logged on every day in this window."),
      );
    }

    if (household.consistency.careDays > 0) {
      highlights.push(
        observe(
          `A feed or walk was recorded on ${household.consistency.careDays} of ${DAYS_IN_WEEK} days.`,
        ),
      );
    }

    const dogsWithPottySuccess = dogs.filter(
      (dog) => dog.pottySuccessCount > 0,
    );

    for (const dog of dogsWithPottySuccess.slice(0, 3)) {
      const classified = dog.pottySuccessCount + dog.pottyAccidentCount;
      highlights.push(
        observe(
          `${dog.dogName} had ${dog.pottySuccessCount} of ${classified} classified potty outcomes marked as a success.`,
        ),
      );
    }

    for (const dog of dogs) {
      if (dog.eventCount === 0) {
        concerns.push(
          observe(
            `${dog.dogName} had no care events logged in this window, so the per-dog summary is incomplete.`,
          ),
        );
      }

      if (dog.pottyAccidentCount > 0) {
        concerns.push(
          observe(
            `${dog.dogName} had ${pluralize(dog.pottyAccidentCount, "accident")} recorded in this window. This is a count of logged events, not a diagnosis.`,
          ),
        );
      }
    }

    const unclassifiedToiletEvents =
      household.toiletCount -
      household.pottySuccessCount -
      household.pottyAccidentCount;

    if (unclassifiedToiletEvents > 0) {
      concerns.push(
        observe(
          `${pluralize(unclassifiedToiletEvents, "toilet event")} did not have a success or accident outcome recorded, so ${
            unclassifiedToiletEvents === 1 ? "it is" : "they are"
          } not included in the success rate.`,
        ),
      );
    }

    if (household.activeDayCount < DAYS_IN_WEEK) {
      concerns.push(
        observe(
          `Care was logged on ${household.activeDayCount} of ${DAYS_IN_WEEK} days. The report only reflects days with logged events.`,
        ),
      );
    }
  }

  if (household.dogsWithWeightTrend > 0) {
    highlights.push(
      observe(
        `Weight change is available for ${pluralize(household.dogsWithWeightTrend, "dog")} with at least two weigh-ins in this window.`,
      ),
    );
  }

  for (const dog of dogs) {
    if (dog.weightLogCount === 1) {
      concerns.push(
        observe(
          `${dog.dogName} had one weigh-in in this window, so a weight change is not shown. Two or more weigh-ins are needed to compare.`,
        ),
      );
    }
  }

  return { highlights, concerns };
}

/**
 * Build a seven-day progress report from the household's own logged data.
 *
 * The window covers the seven local calendar dates ending on `now`'s local
 * date. It starts at local midnight six days before `now` and ends at `now`,
 * so "active days" and consistency are always measured out of seven days.
 * Events for dogs outside the supplied list and events with unusable
 * timestamps are ignored.
 */
export function buildWeeklyReport(
  dogs: Dog[],
  events: CareEvent[],
  weightLogs: WeightLog[],
  now: Date = new Date(),
): WeeklyReport {
  const reference = Number.isFinite(now.getTime()) ? now : new Date();
  const windowStart = new Date(
    reference.getFullYear(),
    reference.getMonth(),
    reference.getDate() - (DAYS_IN_WEEK - 1),
  );
  const startTime = windowStart.getTime();
  const endTime = reference.getTime();
  const dayKeys = localDayKeys(windowStart, DAYS_IN_WEEK);
  const dogIds = new Set(dogs.map((dog) => dog.dogId));

  const eventsInWindow: WindowEvent[] = [];
  for (const event of events) {
    if (!dogIds.has(event.dogId)) continue;

    const timestamp = parseTimestamp(event.timestamp);
    if (timestamp === null || timestamp < startTime || timestamp > endTime) {
      continue;
    }

    eventsInWindow.push({
      event,
      timestamp,
      dayKey: localDateKey(new Date(timestamp)),
    });
  }

  const weightsByDog = new Map<string, WindowWeightLog[]>();
  for (const dogId of dogIds) {
    weightsByDog.set(dogId, []);
  }

  for (const log of weightLogs) {
    if (!dogIds.has(log.dogId) || !Number.isFinite(log.weight)) continue;

    const timestamp = parseTimestamp(log.recordedAt);
    if (timestamp === null || timestamp < startTime || timestamp > endTime) {
      continue;
    }

    weightsByDog.get(log.dogId)?.push({ log, timestamp });
  }

  const eventsByDog = new Map<string, WindowEvent[]>();
  for (const dogId of dogIds) {
    eventsByDog.set(dogId, []);
  }

  for (const entry of eventsInWindow) {
    eventsByDog.get(entry.event.dogId)?.push(entry);
  }

  const dogSummaries = dogs.map((dog) =>
    buildDogSummary(
      dog,
      eventsByDog.get(dog.dogId) ?? [],
      weightsByDog.get(dog.dogId) ?? [],
      dayKeys,
    ),
  );
  const household = buildHouseholdSummary(
    dogs,
    eventsInWindow,
    weightsByDog,
    dayKeys,
  );
  const { highlights, concerns } = buildObservations(dogSummaries, household);

  return {
    window: {
      start: windowStart.toISOString(),
      end: reference.toISOString(),
      days: DAYS_IN_WEEK,
    },
    generatedAt: reference.toISOString(),
    household,
    dogs: dogSummaries,
    highlights,
    concerns,
    disclaimer: WEEKLY_REPORT_DISCLAIMER,
  };
}
