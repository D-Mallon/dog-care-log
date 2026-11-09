import type { CareEvent, Dog } from "../types/core.ts";
import { formatDurationHours } from "./dates.ts";

export type PottyConfidence = "low" | "medium" | "high";

export type PottySummary = {
  todaySuccess: number;
  todayAccidents: number;
  successRate7d: number | null; // 0..1
  accidents7d: number;
  medianIntervalHours: number | null;
  nextWindowStart: string | null; // ISO
  nextWindowEnd: string | null; // ISO
  confidence: PottyConfidence;
  lastPottyAt: string | null;
  accidentPattern: string | null;
  tips: string[];
};

type PottyClassification = "success" | "accident" | "unclassified";

type AgeInfo = {
  months: number | null;
  isPuppy: boolean;
};

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const WINDOW_HALF_MS = 30 * 60 * 1000;
const MIN_INTERVAL_HOURS = 0.25;
const PUPPY_MAX_INTERVAL_HOURS = 12;
const ADULT_MAX_INTERVAL_HOURS = 24;
const MAX_ACCIDENT_GAP_HOURS = 24;
const DAYS_PER_MONTH = 30.4375;

const DISCLAIMER_TIP =
  "General training guidance, not veterinary advice.";

function roundToOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

/**
 * pottyOutcome is authoritative when present. Legacy events only have
 * isAccident, and an event with neither field stays unclassified so it is
 * never silently counted as a success.
 */
function classify(event: CareEvent): PottyClassification {
  if (event.pottyOutcome === "accident") return "accident";
  if (event.pottyOutcome === "success") return "success";
  if (event.isAccident === true) return "accident";
  return "unclassified";
}

function eventTime(event: CareEvent): number {
  return new Date(event.timestamp).getTime();
}

function getAgeInfo(dog: Dog, now: Date): AgeInfo {
  if (dog.dateOfBirth) {
    const dateOfBirthMs = new Date(dog.dateOfBirth).getTime();
    if (Number.isFinite(dateOfBirthMs) && dateOfBirthMs <= now.getTime()) {
      const months =
        (now.getTime() - dateOfBirthMs) / (DAY_MS * DAYS_PER_MONTH);
      return { months, isPuppy: months < 6 };
    }
  }

  if (
    typeof dog.age === "number" &&
    Number.isFinite(dog.age) &&
    dog.age >= 0
  ) {
    return { months: dog.age * 12, isPuppy: dog.age < 0.5 };
  }

  return { months: null, isPuppy: false };
}

/**
 * Cold-start defaults, used when there is no usable interval history yet.
 * Deliberately conservative ranges rather than a precise schedule.
 */
function defaultIntervalHours(ageMonths: number | null): number {
  if (ageMonths === null) return 4;
  if (ageMonths < 3) return 1.5;
  if (ageMonths < 6) return 2.5;
  if (ageMonths < 12) return 3.5;
  return 5;
}

/**
 * Successful pee events are the best signal for a dog's cadence. Before
 * structured outcomes existed there is no success flag, so legacy data uses
 * every toilet event as a cadence anchor.
 */
function intervalSource(
  recentToiletEvents: CareEvent[],
  hasStructuredOutcomes: boolean,
): CareEvent[] {
  if (!hasStructuredOutcomes) {
    return recentToiletEvents;
  }

  return recentToiletEvents.filter(
    (event) =>
      classify(event) === "success" &&
      (event.subtype === "pee" || event.subtype === undefined),
  );
}

function buildAccidentPattern(
  recentAccidents: CareEvent[],
  allToiletEvents: CareEvent[],
): string | null {
  if (recentAccidents.length < 2) return null;

  const accidentGaps: number[] = [];
  for (const accident of recentAccidents) {
    const accidentTime = eventTime(accident);
    let previous: CareEvent | null = null;

    for (const event of allToiletEvents) {
      const time = eventTime(event);
      if (time < accidentTime) {
        previous = event;
      } else {
        break;
      }
    }

    if (!previous) continue;

    const hours = (accidentTime - eventTime(previous)) / HOUR_MS;
    if (hours >= MIN_INTERVAL_HOURS && hours <= MAX_ACCIDENT_GAP_HOURS) {
      accidentGaps.push(hours);
    }
  }

  // A single gap is anecdote, not a pattern.
  if (accidentGaps.length < 2) return null;

  const medianGap = roundToOneDecimal(median(accidentGaps) ?? 0);
  return `In the last 7 days, accidents tended to happen about ${formatDurationHours(
    medianGap,
  )} after the last toilet break (${accidentGaps.length} logged).`;
}

function buildTips(params: {
  age: AgeInfo;
  recentEventCount: number;
  medianIntervalHours: number | null;
  accidents7d: number;
  success7d: number;
  successRate7d: number | null;
  askedSuccesses: number;
}): string[] {
  const {
    age,
    recentEventCount,
    medianIntervalHours,
    accidents7d,
    success7d,
    successRate7d,
    askedSuccesses,
  } = params;

  const suggestions: string[] = [];

  if (age.isPuppy) {
    suggestions.push(
      "Puppies under six months often need a toilet break every 1–2 hours while awake — after meals, naps and play are good moments to offer one.",
    );
  }

  if (recentEventCount < 3 || medianIntervalHours === null) {
    suggestions.push(
      "Log a few more toilet breaks so the next-window estimate has more to learn from.",
    );
  }

  if (accidents7d >= 2) {
    suggestions.push(
      "If accidents cluster around a similar point, try offering a toilet break a little earlier than the usual window.",
    );
  } else if (accidents7d === 1) {
    suggestions.push(
      "One accident is a data point, not a setback — note what happened just before it to spot a pattern.",
    );
  }

  if (
    suggestions.length < 2 &&
    askedSuccesses >= 2 &&
    accidents7d === 0
  ) {
    suggestions.push(
      "Your dog has started asking for the toilet — responding promptly helps reinforce that signal.",
    );
  }

  if (
    suggestions.length < 2 &&
    success7d >= 3 &&
    (successRate7d ?? 0) >= 0.8
  ) {
    suggestions.push(
      "Keep the routine, cue and praise consistent; the current pattern is working well.",
    );
  }

  if (suggestions.length === 0) {
    suggestions.push(
      "Offer a toilet break at the start of the predicted window and praise calm success.",
    );
  }

  return [...suggestions.slice(0, 2), DISCLAIMER_TIP];
}

function confidenceFor(params: {
  intervalCount: number;
  success7d: number;
  recentEventCount: number;
  age: AgeInfo;
}): PottyConfidence {
  const { intervalCount, success7d, recentEventCount, age } = params;

  let confidence: PottyConfidence;

  if (intervalCount >= 5 && success7d >= 5) {
    confidence = "high";
  } else if (intervalCount >= 2 && recentEventCount >= 3) {
    confidence = "medium";
  } else {
    confidence = "low";
  }

  // Puppies change quickly, so cap confidence one level lower.
  if (age.isPuppy) {
    confidence = confidence === "high" ? "medium" : "low";
  }

  return confidence;
}

/**
 * Rule-based potty-training summary for the last seven days.
 *
 * Pure and deterministic for a given `events`, `dog` and `now`. The next
 * window is an estimate (last potty + median interval, or an age-based
 * default) and may already be in the past so the UI can surface "overdue".
 */
export function summarizePotty(
  events: CareEvent[],
  dog: Dog,
  now: Date = new Date(),
): PottySummary {
  const nowMs = now.getTime();
  const todayStartMs = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const windowStartMs = nowMs - 7 * DAY_MS;

  const toiletEvents = events
    .filter((event) => {
      if (event.type !== "toilet") return false;
      const time = eventTime(event);
      return Number.isFinite(time) && time <= nowMs;
    })
    .sort((a, b) => eventTime(a) - eventTime(b));

  const recentToiletEvents = toiletEvents.filter(
    (event) => eventTime(event) >= windowStartMs,
  );

  const recentTransactions = recentToiletEvents.map((event) => ({
    event,
    classification: classify(event),
  }));

  const todaySuccess = toiletEvents.filter(
    (event) =>
      eventTime(event) >= todayStartMs && classify(event) === "success",
  ).length;
  const todayAccidents = toiletEvents.filter(
    (event) =>
      eventTime(event) >= todayStartMs && classify(event) === "accident",
  ).length;

  const success7d = recentTransactions.filter(
    (item) => item.classification === "success",
  ).length;
  const accidents7d = recentTransactions.filter(
    (item) => item.classification === "accident",
  ).length;
  const successRate7d =
    success7d + accidents7d > 0
      ? success7d / (success7d + accidents7d)
      : null;

  const hasStructuredOutcomes = recentToiletEvents.some(
    (event) => event.pottyOutcome !== undefined,
  );
  const intervalEvents = intervalSource(
    recentToiletEvents,
    hasStructuredOutcomes,
  );

  const age = getAgeInfo(dog, now);
  const maxIntervalHours = age.isPuppy
    ? PUPPY_MAX_INTERVAL_HOURS
    : ADULT_MAX_INTERVAL_HOURS;
  const intervals: number[] = [];
  for (let index = 1; index < intervalEvents.length; index += 1) {
    const hours =
      (eventTime(intervalEvents[index]) -
        eventTime(intervalEvents[index - 1])) /
      HOUR_MS;
    if (hours >= MIN_INTERVAL_HOURS && hours <= maxIntervalHours) {
      intervals.push(hours);
    }
  }

  const medianIntervalHours =
    intervals.length > 0
      ? roundToOneDecimal(median(intervals) ?? 0)
      : null;

  const lastPotty = toiletEvents[toiletEvents.length - 1] ?? null;
  let nextWindowStart: string | null = null;
  let nextWindowEnd: string | null = null;

  if (lastPotty) {
    const intervalHours =
      medianIntervalHours ?? defaultIntervalHours(age.months);
    const expectedMs = eventTime(lastPotty) + intervalHours * HOUR_MS;
    nextWindowStart = new Date(expectedMs - WINDOW_HALF_MS).toISOString();
    nextWindowEnd = new Date(expectedMs + WINDOW_HALF_MS).toISOString();
  }

  const recentAccidents = recentTransactions
    .filter((item) => item.classification === "accident")
    .map((item) => item.event);
  const askedSuccesses = recentTransactions.filter(
    (item) =>
      item.classification === "success" && item.event.pottyCue === "asked",
  ).length;

  const tips = buildTips({
    age,
    recentEventCount: recentToiletEvents.length,
    medianIntervalHours,
    accidents7d,
    success7d,
    successRate7d,
    askedSuccesses,
  });

  return {
    todaySuccess,
    todayAccidents,
    successRate7d,
    accidents7d,
    medianIntervalHours,
    nextWindowStart,
    nextWindowEnd,
    confidence: confidenceFor({
      intervalCount: intervals.length,
      success7d,
      recentEventCount: recentToiletEvents.length,
      age,
    }),
    lastPottyAt: lastPotty?.timestamp ?? null,
    accidentPattern: buildAccidentPattern(recentAccidents, toiletEvents),
    tips,
  };
}
