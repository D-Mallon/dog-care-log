import type { CareEvent, Dog, PottyOutcome, WeightLog } from "../types/core.ts";

/**
 * Bump this whenever feature keys, semantics or filtering rules change.
 * A snapshot is only comparable with another snapshot that has the same
 * version.
 */
export const ML_FEATURE_VERSION = 1;

/** A single scalar feature value. Null means "not enough data". */
export type FeatureValue = number | string | boolean | null;

/**
 * A point-in-time, analysis-ready feature row for one dog.
 *
 * This is input for offline analysis and future models only — it is not a
 * diagnosis, a health assessment or veterinary advice. Features deliberately
 * exclude owner names, emails, notes, images, household identifiers and
 * free-text medical fields.
 */
export interface DogFeatureSnapshot {
  version: number;
  dogId: string;
  generatedAt: string;
  windowDays: 7 | 14 | 28;
  features: Record<string, FeatureValue>;
}

type WindowEvent = {
  event: CareEvent;
  timestamp: number;
  date: Date;
  dayKey: string;
};

type WindowWeightLog = {
  log: WeightLog;
  timestamp: number;
};

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const DAYS_PER_MONTH = 30.4375;
const PUPPY_MONTHS = 6;
const MIN_INTERVAL_HOURS = 0.25;
const PUPPY_MAX_INTERVAL_HOURS = 12;
const ADULT_MAX_INTERVAL_HOURS = 24;

/**
 * Round a numeric feature to four decimals. Returns null for any
 * non-finite input so NaN/Infinity can never leak into a snapshot.
 */
function roundFeature(value: number): number | null {
  if (!Number.isFinite(value)) return null;
  const rounded = Math.round(value * 10_000) / 10_000;
  return Object.is(rounded, -0) ? 0 : rounded;
}

function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildDayKeys(firstDay: Date, count: number): string[] {
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

function positiveOrNull(value: number | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null;
  }
  return roundFeature(value);
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

/**
 * pottyOutcome is authoritative when present. Legacy events only carry
 * isAccident, and an event with neither stays unclassified so it never
 * silently counts as a success.
 */
function classifyPotty(event: CareEvent): PottyOutcome | null {
  if (event.pottyOutcome === "success" || event.pottyOutcome === "accident") {
    return event.pottyOutcome;
  }
  if (event.isAccident === true) return "accident";
  if (event.isAccident === false) return "success";
  return null;
}

function computeAge(
  dog: Dog,
  referenceMs: number,
): { days: number | null; months: number | null } {
  if (dog.dateOfBirth) {
    const birthMs = parseTimestamp(dog.dateOfBirth);
    if (birthMs !== null && birthMs <= referenceMs) {
      const days = (referenceMs - birthMs) / DAY_MS;
      return { days: roundFeature(days), months: days / DAYS_PER_MONTH };
    }
  }

  if (typeof dog.age === "number" && Number.isFinite(dog.age) && dog.age >= 0) {
    return { days: roundFeature(dog.age * 365.25), months: dog.age * 12 };
  }

  return { days: null, months: null };
}

function perActiveDay(count: number, activeDays: number): number | null {
  if (activeDays <= 0) return null;
  return roundFeature(count / activeDays);
}

function share(count: number, total: number): number | null {
  if (total <= 0) return null;
  return roundFeature(count / total);
}

/**
 * Build a versioned feature snapshot for one dog over a rolling window of
 * local calendar days ending at `now`.
 *
 * The window covers the `windowDays` local dates ending on `now`'s local
 * date: it starts at local midnight `windowDays - 1` days before `now` and
 * ends at `now` itself. The snapshot is pure and deterministic for a given
 * `dog`, `events`, `weightLogs`, `now` and `windowDays`: events for other
 * dogs, unusable timestamps and anything after `now` are ignored.
 *
 * Feature values are numeric, categorical or null when there is not enough
 * data; rates are per active logging day and are null when no day has data.
 * No owner, household or free-text data is included.
 */
export function buildDogFeatureSnapshot(
  dog: Dog,
  events: CareEvent[],
  weightLogs: WeightLog[],
  now: Date = new Date(),
  windowDays: 7 | 14 | 28 = 14,
): DogFeatureSnapshot {
  const reference = Number.isFinite(now.getTime()) ? now : new Date();
  const referenceMs = reference.getTime();
  const windowStart = new Date(
    reference.getFullYear(),
    reference.getMonth(),
    reference.getDate() - (windowDays - 1),
  );
  const windowStartMs = windowStart.getTime();
  const dayKeys = buildDayKeys(windowStart, windowDays);

  const windowEvents: WindowEvent[] = [];
  for (const event of events) {
    if (event.dogId !== dog.dogId) continue;

    const timestamp = parseTimestamp(event.timestamp);
    if (
      timestamp === null ||
      timestamp < windowStartMs ||
      timestamp > referenceMs
    ) {
      continue;
    }

    const date = new Date(timestamp);
    windowEvents.push({
      event,
      timestamp,
      date,
      dayKey: localDateKey(date),
    });
  }

  const windowWeights: WindowWeightLog[] = [];
  let latestWeightAtOrBeforeNow: WindowWeightLog | null = null;
  for (const log of weightLogs) {
    if (log.dogId !== dog.dogId) continue;

    const timestamp = parseTimestamp(log.recordedAt);
    if (
      timestamp === null ||
      timestamp > referenceMs ||
      !Number.isFinite(log.weight) ||
      log.weight <= 0
    ) {
      continue;
    }

    if (
      latestWeightAtOrBeforeNow === null ||
      timestamp > latestWeightAtOrBeforeNow.timestamp ||
      (timestamp === latestWeightAtOrBeforeNow.timestamp &&
        log.id.localeCompare(latestWeightAtOrBeforeNow.log.id) > 0)
    ) {
      latestWeightAtOrBeforeNow = { log, timestamp };
    }

    if (timestamp >= windowStartMs) {
      windowWeights.push({ log, timestamp });
    }
  }

  windowWeights.sort(
    (left, right) =>
      left.timestamp - right.timestamp ||
      left.log.id.localeCompare(right.log.id),
  );

  const activeDayKeys = new Set(windowEvents.map(({ dayKey }) => dayKey));

  const feedDays = new Set<string>();
  const walkDays = new Set<string>();
  const toiletDays = new Set<string>();
  let feedCount = 0;
  let waterCount = 0;
  let walkCount = 0;
  let medsCount = 0;
  let playCount = 0;
  let morningCount = 0;
  let eveningCount = 0;
  let weekendCount = 0;

  for (const { event, date, dayKey } of windowEvents) {
    const hour = date.getHours();
    const weekday = date.getDay();

    if (hour >= 6 && hour < 12) morningCount += 1;
    if (hour >= 18) eveningCount += 1;
    if (weekday === 0 || weekday === 6) weekendCount += 1;

    switch (event.type) {
      case "feed":
        feedCount += 1;
        feedDays.add(dayKey);
        break;
      case "water":
        waterCount += 1;
        break;
      case "walk":
        walkCount += 1;
        walkDays.add(dayKey);
        break;
      case "meds":
        medsCount += 1;
        break;
      case "play_time":
        playCount += 1;
        break;
      case "toilet":
        toiletDays.add(dayKey);
        break;
      default:
        break;
    }
  }

  const toiletEvents = windowEvents
    .filter(({ event }) => event.type === "toilet")
    .sort((left, right) => left.timestamp - right.timestamp);

  let pottySuccessCount = 0;
  let pottyAccidentCount = 0;
  for (const { event } of toiletEvents) {
    const outcome = classifyPotty(event);
    if (outcome === "success") pottySuccessCount += 1;
    if (outcome === "accident") pottyAccidentCount += 1;
  }
  const pottyClassifiedCount = pottySuccessCount + pottyAccidentCount;

  const nightPottyCount = toiletEvents.filter(({ date }) => {
    const hour = date.getHours();
    return hour >= 22 || hour < 6;
  }).length;

  const hasStructuredOutcomes = toiletEvents.some(
    ({ event }) => event.pottyOutcome !== undefined,
  );
  const intervalEvents = hasStructuredOutcomes
    ? toiletEvents.filter(
        ({ event }) =>
          classifyPotty(event) === "success" &&
          (event.subtype === "pee" || event.subtype === undefined),
      )
    : toiletEvents;

  const age = computeAge(dog, referenceMs);
  const isPuppy = age.months !== null && age.months < PUPPY_MONTHS;
  const maxIntervalHours = isPuppy
    ? PUPPY_MAX_INTERVAL_HOURS
    : ADULT_MAX_INTERVAL_HOURS;

  const intervals: number[] = [];
  for (let index = 1; index < intervalEvents.length; index += 1) {
    const hours =
      (intervalEvents[index].timestamp -
        intervalEvents[index - 1].timestamp) /
      HOUR_MS;
    if (hours >= MIN_INTERVAL_HOURS && hours <= maxIntervalHours) {
      intervals.push(hours);
    }
  }
  const medianHours = median(intervals);
  const medianIntervalHours =
    medianHours !== null ? roundFeature(medianHours) : null;

  const weightStart =
    windowWeights.length > 0
      ? roundFeature(windowWeights[0].log.weight)
      : null;
  const weightEnd =
    windowWeights.length > 0
      ? roundFeature(windowWeights[windowWeights.length - 1].log.weight)
      : null;

  let weightChange: number | null = null;
  let weightChangePct: number | null = null;
  if (windowWeights.length >= 2 && weightStart !== null && weightEnd !== null) {
    weightChange = roundFeature(weightEnd - weightStart);
    if (weightStart !== 0) {
      weightChangePct = roundFeature(
        ((weightEnd - weightStart) / weightStart) * 100,
      );
    }
  }

  const currentWeight =
    latestWeightAtOrBeforeNow !== null
      ? roundFeature(latestWeightAtOrBeforeNow.log.weight)
      : positiveOrNull(dog.weight);

  const activeLoggingDays = activeDayKeys.size;
  const eventCount = windowEvents.length;
  const toiletCount = toiletEvents.length;

  const features: Record<string, FeatureValue> = {
    // Profile (time-invariant attributes of the dog).
    breed_id:
      typeof dog.breedId === "string" && dog.breedId.length > 0
        ? dog.breedId
        : null,
    sex: dog.sex ?? null,
    neutered: typeof dog.neutered === "boolean" ? dog.neutered : null,
    age_days: age.days,
    size_category: dog.sizeCategory ?? null,
    activity_level: dog.activityLevel ?? null,
    training_stage: dog.trainingStage ?? null,
    current_weight_kg: currentWeight,
    adult_weight_kg: positiveOrNull(dog.adultWeightKg),

    // Window shape.
    window_days: windowDays,
    observed_days: dayKeys.length,
    active_logging_days: activeLoggingDays,
    event_count: eventCount,

    // Rates per active logging day.
    feeds_per_active_day: perActiveDay(feedCount, activeLoggingDays),
    water_per_active_day: perActiveDay(waterCount, activeLoggingDays),
    walks_per_active_day: perActiveDay(walkCount, activeLoggingDays),
    toilets_per_active_day: perActiveDay(toiletCount, activeLoggingDays),
    accidents_per_active_day: perActiveDay(
      pottyAccidentCount,
      activeLoggingDays,
    ),
    meds_per_active_day: perActiveDay(medsCount, activeLoggingDays),
    play_per_active_day: perActiveDay(playCount, activeLoggingDays),

    // Potty outcomes and cadence.
    potty_success_count: pottySuccessCount,
    potty_accident_count: pottyAccidentCount,
    potty_classified_count: pottyClassifiedCount,
    potty_success_rate:
      pottyClassifiedCount > 0
        ? roundFeature(pottySuccessCount / pottyClassifiedCount)
        : null,
    median_potty_interval_hours: medianIntervalHours,
    night_potty_count: nightPottyCount,
    accident_rate_per_toilet: share(pottyAccidentCount, toiletCount),

    // Time-of-day and weekend distribution. Morning is local 06:00–11:59,
    // evening is local 18:00–23:59 and weekend is the local Sat/Sun.
    morning_event_share: share(morningCount, eventCount),
    evening_event_share: share(eveningCount, eventCount),
    weekend_event_share: share(weekendCount, eventCount),

    // Weight trend inside the window.
    weight_log_count: windowWeights.length,
    weight_start_kg: weightStart,
    weight_end_kg: weightEnd,
    weight_change_kg: weightChange,
    weight_change_pct: weightChangePct,

    // Logging consistency (distinct local days).
    feed_days: feedDays.size,
    walk_days: walkDays.size,
    toilet_days: toiletDays.size,
    care_days: activeLoggingDays,
  };

  return {
    version: ML_FEATURE_VERSION,
    dogId: dog.dogId,
    generatedAt: reference.toISOString(),
    windowDays,
    features,
  };
}
