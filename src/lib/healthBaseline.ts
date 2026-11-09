import type { CareEvent, Dog, WeightLog } from "../types/core.ts";

export type BaselineConfidence = "low" | "medium" | "high";
export type InsightSeverity = "info" | "watch" | "attention";
export type InsightDirection = "up" | "down" | "stable";
export type HealthInsightKind =
  | "feeding"
  | "water"
  | "walking"
  | "potty"
  | "weight"
  | "logging";

export interface HealthInsight {
  /** Stable key, e.g. "feeding-intake-down". */
  id: string;
  kind: HealthInsightKind;
  severity: InsightSeverity;
  confidence: BaselineConfidence;
  title: string;
  /** Plain language, includes current vs baseline. */
  detail: string;
  currentLabel: string;
  baselineLabel: string;
  direction: InsightDirection;
  /** General next step, never a diagnosis or treatment. */
  recommendation: string;
}

export interface HealthBaselineMetrics {
  baselineActiveDays: number;
  recentActiveDays: number;
  baselineFeedsPerActiveDay: number | null;
  recentFeedsPerActiveDay: number | null;
  baselineWaterPerActiveDay: number | null;
  recentWaterPerActiveDay: number | null;
  baselineWalksPerActiveDay: number | null;
  recentWalksPerActiveDay: number | null;
  baselineToiletsPerActiveDay: number | null;
  recentToiletsPerActiveDay: number | null;
  baselineAccidentsPerActiveDay: number | null;
  recentAccidentsPerActiveDay: number | null;
  /** 0..1, or null when no toilet event has a usable outcome. */
  baselinePottySuccessRate: number | null;
  recentPottySuccessRate: number | null;
  baselinePottyIntervalHours: number | null;
  recentPottyIntervalHours: number | null;
  baselineWeightKg: number | null;
  latestWeightKg: number | null;
  weightChangePct: number | null;
}

export type DataQuality = "insufficient" | "limited" | "good";

export interface HealthBaselineReport {
  dogId: string;
  generatedAt: string;
  window: {
    recentStart: string;
    recentEnd: string;
    baselineStart: string;
    baselineEnd: string;
    recentDays: number;
    baselineDays: number;
  };
  dataQuality: DataQuality;
  metrics: HealthBaselineMetrics;
  insights: HealthInsight[];
  disclaimer: string;
}

/**
 * Describes the last three days against the two weeks before them. It is a
 * descriptive pattern summary built only from what the household logged.
 * It never diagnoses, treats or rules out a health problem.
 */
export const HEALTH_BASELINE_DISCLAIMER =
  "These are general observations based on the care events logged for this dog. They are not veterinary advice. If you are worried about a dog's health, contact your veterinarian.";

const RECENT_WINDOW_DAYS = 3;
const BASELINE_WINDOW_DAYS = 14;

// Minimum comparisons before any baseline/anomaly claim is made.
const MIN_BASELINE_ACTIVE_DAYS = 5;
const MIN_RECENT_ACTIVE_DAYS = 2;
const GOOD_BASELINE_ACTIVE_DAYS = 10;

// Confidence bands. "Enough events" keeps a single event per day from
// reading as a high-confidence pattern.
const HIGH_CONFIDENCE_ACTIVE_DAYS = 10;
const HIGH_CONFIDENCE_EVENT_COUNT = 20;
const MEDIUM_CONFIDENCE_ACTIVE_DAYS = 7;

// Rate-change thresholds for feeding, water and walking.
const RATE_DROP_RATIO = 0.5; // recent <= 50% of baseline
const RATE_INCREASE_RATIO = 1.8; // recent >= 180% of baseline
const NON_TRIVIAL_BASELINE_RATE = 1; // events per active day
const MIN_ABSOLUTE_DIFF_PER_DAY = 1;
const MIN_ABSOLUTE_DIFF_LOW_BASELINE_PER_DAY = 0.5;
const LARGE_DROP_ABSOLUTE_DIFF_PER_DAY = 1.5;

// Accident thresholds.
const ACCIDENT_INCREASE_RATIO = 2;
const ACCIDENT_ATTENTION_RATIO = 3;

// Potty success-rate threshold (percentage points, expressed 0..1).
const SUCCESS_RATE_DROP_THRESHOLD = 0.2;
const MIN_CLASSIFIED_RECENT = 2;
const MIN_CLASSIFIED_BASELINE = 4;

// Toilet interval thresholds.
const MIN_INTERVAL_HOURS = 0.25;
const MAX_INTERVAL_HOURS = 24;
const INTERVAL_CHANGE_RATIO = 1.5; // >= 50% longer or shorter
const MIN_INTERVAL_DIFF_HOURS = 0.5;

// Weight thresholds.
const MIN_BASELINE_WEIGHTS = 2;
const MIN_RECENT_WEIGHTS = 1;
const WEIGHT_CHANGE_INFO_PCT = 5;
const WEIGHT_CHANGE_WATCH_PCT = 10;

const MAX_INSIGHTS = 4;

const RECENT_DESCRIPTION = "the last 3 days";
const BASELINE_DESCRIPTION = "the previous two weeks";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const CONFIDENCE_RANK: Record<BaselineConfidence, number> = {
  low: 0,
  medium: 1,
  high: 2,
};

const SEVERITY_RANK: Record<InsightSeverity, number> = {
  info: 0,
  watch: 1,
  attention: 2,
};

type PottyClassification = "success" | "accident";

type WindowBucket = {
  activeDayKeys: Set<string>;
  eventCount: number;
  feedCount: number;
  waterCount: number;
  walkCount: number;
  toiletTimes: number[];
  successCount: number;
  accidentCount: number;
};

type TimedWeight = {
  weight: number;
  timestamp: number;
  id: string;
};

function roundTo(value: number, decimalPlaces: number): number {
  const factor = 10 ** decimalPlaces;
  return Math.round(value * factor) / factor;
}

function formatNumber(value: number, maximumFractionDigits = 1): string {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits,
  }).format(value);
}

function formatPercent(rate: number): string {
  return new Intl.NumberFormat(undefined, {
    style: "percent",
    maximumFractionDigits: 0,
  }).format(rate);
}

function pluralize(
  count: number,
  singular: string,
  pluralForm = `${singular}s`,
): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;

  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseTimestamp(value: string): number | null {
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

/**
 * pottyOutcome is authoritative when present. Legacy events only have
 * isAccident. An event with neither field stays unclassified and is never
 * counted as a success.
 */
function classifyPotty(event: CareEvent): PottyClassification | null {
  if (event.pottyOutcome === "success" || event.pottyOutcome === "accident") {
    return event.pottyOutcome;
  }
  if (event.isAccident === true) return "accident";
  if (event.isAccident === false) return "success";
  return null;
}

function emptyBucket(): WindowBucket {
  return {
    activeDayKeys: new Set<string>(),
    eventCount: 0,
    feedCount: 0,
    waterCount: 0,
    walkCount: 0,
    toiletTimes: [],
    successCount: 0,
    accidentCount: 0,
  };
}

/**
 * Collect one dog's events inside [startMs, endMs). The recent window ends
 * inclusively at `now`, so its end is passed with `endInclusive`.
 */
function collectEvents(params: {
  events: CareEvent[];
  dogId: string;
  startMs: number;
  endMs: number;
  endInclusive: boolean;
}): WindowBucket {
  const { events, dogId, startMs, endMs, endInclusive } = params;
  const bucket = emptyBucket();

  for (const event of events) {
    if (event.dogId !== dogId) continue;

    const timestamp = parseTimestamp(event.timestamp);
    if (timestamp === null) continue;
    if (timestamp < startMs) continue;
    if (endInclusive ? timestamp > endMs : timestamp >= endMs) continue;

    bucket.eventCount += 1;
    bucket.activeDayKeys.add(localDateKey(new Date(timestamp)));

    if (event.type === "feed") bucket.feedCount += 1;
    if (event.type === "water") bucket.waterCount += 1;
    if (event.type === "walk") bucket.walkCount += 1;

    if (event.type === "toilet") {
      bucket.toiletTimes.push(timestamp);
      const classification = classifyPotty(event);
      if (classification === "success") bucket.successCount += 1;
      if (classification === "accident") bucket.accidentCount += 1;
    }
  }

  return bucket;
}

function collectWeights(params: {
  weightLogs: WeightLog[];
  dogId: string;
  startMs: number;
  endMs: number;
  endInclusive: boolean;
}): TimedWeight[] {
  const { weightLogs, dogId, startMs, endMs, endInclusive } = params;
  const weights: TimedWeight[] = [];

  for (const log of weightLogs) {
    if (log.dogId !== dogId) continue;
    if (!Number.isFinite(log.weight) || log.weight <= 0) continue;

    const timestamp = parseTimestamp(log.recordedAt);
    if (timestamp === null) continue;
    if (timestamp < startMs) continue;
    if (endInclusive ? timestamp > endMs : timestamp >= endMs) continue;

    weights.push({ weight: log.weight, timestamp, id: log.id });
  }

  weights.sort(
    (left, right) =>
      left.timestamp - right.timestamp || left.id.localeCompare(right.id),
  );

  return weights;
}

/** Raw rate, or null when a window has no active logging day. */
function ratePerActiveDay(
  count: number,
  activeDays: number,
): number | null {
  return activeDays > 0 ? count / activeDays : null;
}

function successRate(bucket: WindowBucket): number | null {
  const classified = bucket.successCount + bucket.accidentCount;
  return classified > 0 ? bucket.successCount / classified : null;
}

function medianIntervalHours(times: number[]): {
  hours: number | null;
  count: number;
} {
  if (times.length < 2) return { hours: null, count: 0 };

  const sorted = [...times].sort((left, right) => left - right);
  const intervals: number[] = [];

  for (let index = 1; index < sorted.length; index += 1) {
    const hours = (sorted[index] - sorted[index - 1]) / HOUR_MS;
    if (hours >= MIN_INTERVAL_HOURS && hours <= MAX_INTERVAL_HOURS) {
      intervals.push(hours);
    }
  }

  if (intervals.length === 0) return { hours: null, count: 0 };

  return {
    hours: median(intervals) ?? null,
    count: intervals.length,
  };
}

function capConfidence(
  value: BaselineConfidence,
  cap: BaselineConfidence,
): BaselineConfidence {
  return CONFIDENCE_RANK[value] <= CONFIDENCE_RANK[cap] ? value : cap;
}

function baseConfidence(
  baselineActiveDays: number,
  baselineEventCount: number,
): BaselineConfidence {
  if (
    baselineActiveDays >= HIGH_CONFIDENCE_ACTIVE_DAYS &&
    baselineEventCount >= HIGH_CONFIDENCE_EVENT_COUNT
  ) {
    return "high";
  }
  if (baselineActiveDays >= MEDIUM_CONFIDENCE_ACTIVE_DAYS) return "medium";
  return "low";
}

/**
 * Sparse category evidence (a rare event type, or very few recent events)
 * caps how strongly an insight is stated.
 */
function signalConfidence(
  base: BaselineConfidence,
  recentCount: number,
  baselineCount: number,
): BaselineConfidence {
  if (baselineCount < 2) return "low";
  if (recentCount < 2) return capConfidence(base, "medium");
  return base;
}

function buildRateInsight(params: {
  kind: "feeding" | "water" | "walking";
  label: string;
  idPrefix: string;
  recentCount: number;
  baselineCount: number;
  recentActiveDays: number;
  baselineActiveDays: number;
  dogName: string;
  base: BaselineConfidence;
}): HealthInsight | null {
  const {
    kind,
    label,
    idPrefix,
    recentCount,
    baselineCount,
    recentActiveDays,
    baselineActiveDays,
    dogName,
    base,
  } = params;

  const recentRate = ratePerActiveDay(recentCount, recentActiveDays);
  const baselineRate = ratePerActiveDay(baselineCount, baselineActiveDays);
  if (recentRate === null || baselineRate === null || baselineRate <= 0) {
    return null;
  }

  const absoluteDiff = Math.abs(recentRate - baselineRate);
  const requiredDiff =
    baselineRate >= NON_TRIVIAL_BASELINE_RATE
      ? MIN_ABSOLUTE_DIFF_PER_DAY
      : MIN_ABSOLUTE_DIFF_LOW_BASELINE_PER_DAY;

  const dropped =
    recentRate <= baselineRate * RATE_DROP_RATIO &&
    baselineRate - recentRate >= requiredDiff;
  const increased =
    recentRate >= baselineRate * RATE_INCREASE_RATIO &&
    recentRate - baselineRate >= requiredDiff;

  if (!dropped && !increased) return null;

  const direction: InsightDirection = dropped ? "down" : "up";
  const largeSustainedDrop =
    dropped &&
    (kind === "feeding" || kind === "water") &&
    absoluteDiff >= LARGE_DROP_ABSOLUTE_DIFF_PER_DAY &&
    recentRate <= baselineRate * RATE_DROP_RATIO;

  const severity: InsightSeverity = largeSustainedDrop ? "attention" : "watch";
  const confidence = signalConfidence(base, recentCount, baselineCount);
  const currentLabel = `${formatNumber(recentRate)} per active day`;
  const baselineLabel = `${formatNumber(baselineRate)} per active day`;

  return {
    id: `${idPrefix}-${direction}`,
    kind,
    severity,
    confidence,
    title: `${label} is ${dropped ? "below" : "above"} baseline`,
    detail: `${dogName}'s ${label.toLowerCase()} averaged ${currentLabel} in ${RECENT_DESCRIPTION}, compared with ${baselineLabel} in ${BASELINE_DESCRIPTION}. This is a pattern observation, not veterinary advice.`,
    currentLabel,
    baselineLabel,
    direction,
    recommendation: dropped
      ? "Watch whether this continues. If you are worried, contact your veterinarian."
      : "Keep logging for a few more days to see whether this continues.",
  };
}

function buildAccidentInsight(params: {
  recentAccidents: number;
  baselineAccidents: number;
  recentActiveDays: number;
  baselineActiveDays: number;
  dogName: string;
  base: BaselineConfidence;
}): HealthInsight | null {
  const {
    recentAccidents,
    baselineAccidents,
    recentActiveDays,
    baselineActiveDays,
    dogName,
    base,
  } = params;

  if (recentAccidents < 1) return null;

  const recentRate = ratePerActiveDay(recentAccidents, recentActiveDays);
  const baselineRate = ratePerActiveDay(baselineAccidents, baselineActiveDays);
  if (recentRate === null || baselineRate === null) return null;

  const aboveBaseline =
    baselineRate === 0 ||
    recentRate > baselineRate * ACCIDENT_INCREASE_RATIO;
  if (!aboveBaseline) return null;

  let severity: InsightSeverity = "watch";
  if (baselineRate === 0) {
    severity = recentAccidents >= 2 ? "attention" : "watch";
  } else if (
    recentAccidents >= 2 &&
    recentRate >= baselineRate * ACCIDENT_ATTENTION_RATIO
  ) {
    severity = "attention";
  }

  const confidence =
    recentAccidents >= 2
      ? base
      : capConfidence(base, "low");

  return {
    id: "potty-accidents-up",
    kind: "potty",
    severity,
    confidence,
    title: "Potty accidents are above baseline",
    detail: `${dogName} had ${pluralize(recentAccidents, "accident")} in ${RECENT_DESCRIPTION}, compared with about ${formatNumber(baselineRate)} per active day in ${BASELINE_DESCRIPTION}. This is a pattern observation, not veterinary advice.`,
    currentLabel: `${pluralize(recentAccidents, "accident")} in ${RECENT_WINDOW_DAYS} days`,
    baselineLabel: `${formatNumber(baselineRate)} per active day`,
    direction: "up",
    recommendation:
      "Watch whether this continues. If you are worried, contact your veterinarian.",
  };
}

function buildSuccessRateInsight(params: {
  baselineRate: number | null;
  recentRate: number | null;
  baselineClassified: number;
  recentClassified: number;
  dogName: string;
  base: BaselineConfidence;
}): HealthInsight | null {
  const {
    baselineRate,
    recentRate,
    baselineClassified,
    recentClassified,
    dogName,
    base,
  } = params;

  if (
    baselineRate === null ||
    recentRate === null ||
    baselineClassified < MIN_CLASSIFIED_BASELINE ||
    recentClassified < MIN_CLASSIFIED_RECENT
  ) {
    return null;
  }

  if (baselineRate - recentRate < SUCCESS_RATE_DROP_THRESHOLD) return null;

  let confidence = base;
  if (recentClassified < 3 || baselineClassified < 5) {
    confidence = capConfidence(confidence, "low");
  } else if (recentClassified < 5 || baselineClassified < 8) {
    confidence = capConfidence(confidence, "medium");
  }

  return {
    id: "potty-success-down",
    kind: "potty",
    severity: "watch",
    confidence,
    title: "Potty success rate is below baseline",
    detail: `${dogName}'s potty success rate was ${formatPercent(recentRate)} in ${RECENT_DESCRIPTION}, compared with ${formatPercent(baselineRate)} in ${BASELINE_DESCRIPTION} (${recentClassified} classified outcomes recently). This is a pattern observation, not veterinary advice.`,
    currentLabel: `${formatPercent(recentRate)} success`,
    baselineLabel: `${formatPercent(baselineRate)} success`,
    direction: "down",
    recommendation:
      "Keep logging each outcome and watch whether this continues. If you are worried, contact your veterinarian.",
  };
}

function buildIntervalInsight(params: {
  baselineHours: number | null;
  recentHours: number | null;
  baselineIntervals: number;
  recentIntervals: number;
  dogName: string;
  base: BaselineConfidence;
}): HealthInsight | null {
  const {
    baselineHours,
    recentHours,
    baselineIntervals,
    recentIntervals,
    dogName,
    base,
  } = params;

  // Two intervals each is the minimum for a median worth comparing.
  if (
    baselineHours === null ||
    recentHours === null ||
    baselineIntervals < 2 ||
    recentIntervals < 2 ||
    baselineHours <= 0
  ) {
    return null;
  }

  const absoluteDiff = Math.abs(recentHours - baselineHours);
  if (absoluteDiff < MIN_INTERVAL_DIFF_HOURS) return null;

  const longer = recentHours >= baselineHours * INTERVAL_CHANGE_RATIO;
  const shorter = recentHours <= baselineHours / INTERVAL_CHANGE_RATIO;
  if (!longer && !shorter) return null;

  const confidence =
    baselineIntervals >= 3 && recentIntervals >= 3
      ? base
      : capConfidence(base, "low");

  return {
    id: longer ? "potty-interval-longer" : "potty-interval-shorter",
    kind: "potty",
    severity: "watch",
    confidence,
    title: `Toilet intervals are ${longer ? "longer" : "shorter"} than baseline`,
    detail: `${dogName}'s median toilet interval was ${formatNumber(recentHours)} hours in ${RECENT_DESCRIPTION}, compared with ${formatNumber(baselineHours)} hours in ${BASELINE_DESCRIPTION}. Longer intervals can mean fewer logged opportunities; shorter intervals can mean more frequent trips. This is a pattern observation, not veterinary advice.`,
    currentLabel: `${formatNumber(recentHours)}h median interval`,
    baselineLabel: `${formatNumber(baselineHours)}h median interval`,
    direction: longer ? "up" : "down",
    recommendation:
      "Watch whether this continues and keep logging toilet breaks.",
  };
}

function buildWeightInsight(params: {
  baselineWeights: TimedWeight[];
  recentWeights: TimedWeight[];
  dogName: string;
  base: BaselineConfidence;
}): HealthInsight | null {
  const { baselineWeights, recentWeights, dogName, base } = params;

  if (
    baselineWeights.length < MIN_BASELINE_WEIGHTS ||
    recentWeights.length < MIN_RECENT_WEIGHTS
  ) {
    return null;
  }

  const baselineMedian = median(baselineWeights.map((entry) => entry.weight));
  const latest = recentWeights[recentWeights.length - 1];
  if (baselineMedian === null || baselineMedian <= 0) return null;

  const changePct = ((latest.weight - baselineMedian) / baselineMedian) * 100;
  const absoluteChangePct = Math.abs(changePct);
  if (absoluteChangePct < WEIGHT_CHANGE_INFO_PCT) return null;

  const severity: InsightSeverity =
    absoluteChangePct >= WEIGHT_CHANGE_WATCH_PCT ? "watch" : "info";
  const direction: InsightDirection = changePct > 0 ? "up" : "down";

  let confidence = base;
  if (baselineWeights.length <= 2 || recentWeights.length === 1) {
    confidence = capConfidence(confidence, "low");
  } else if (baselineWeights.length <= 4) {
    confidence = capConfidence(confidence, "medium");
  }

  return {
    id: `weight-change-${direction}`,
    kind: "weight",
    severity,
    confidence,
    title: `Weight is ${direction === "up" ? "above" : "below"} the recent baseline`,
    detail: `${dogName}'s latest logged weight is ${formatNumber(latest.weight, 2)} kg, compared with a baseline median of ${formatNumber(baselineMedian, 2)} kg in ${BASELINE_DESCRIPTION} (${changePct > 0 ? "+" : ""}${formatNumber(changePct)}%). Weight can vary with measurement conditions. This is a pattern observation, not veterinary advice.`,
    currentLabel: `${formatNumber(latest.weight, 2)} kg latest`,
    baselineLabel: `${formatNumber(baselineMedian, 2)} kg median`,
    direction,
    recommendation:
      "Keep logging weight and watch the trend. If you are worried, contact your veterinarian.",
  };
}

function buildLoggingInsight(params: {
  baselineActiveDays: number;
  recentActiveDays: number;
  dogName: string;
}): HealthInsight {
  const { baselineActiveDays, recentActiveDays, dogName } = params;
  const neededBaseline = Math.max(
    0,
    MIN_BASELINE_ACTIVE_DAYS - baselineActiveDays,
  );
  const neededRecent = Math.max(0, MIN_RECENT_ACTIVE_DAYS - recentActiveDays);

  const needed: string[] = [];
  if (neededBaseline > 0) {
    needed.push(pluralize(neededBaseline, "more baseline active day"));
  }
  if (neededRecent > 0) {
    needed.push(pluralize(neededRecent, "more recent active day"));
  }

  const guidance =
    needed.length > 0
      ? `${needed.join(" and ")} would make the comparison more useful.`
      : "A few more logged days would make the comparison more useful.";

  return {
    id: "logging-insufficient",
    kind: "logging",
    severity: "info",
    confidence: "low",
    title: "More logging days needed",
    detail: `${dogName} has ${pluralize(baselineActiveDays, "active baseline day")} in ${BASELINE_DESCRIPTION} and ${pluralize(recentActiveDays, "active day")} in ${RECENT_DESCRIPTION}. ${guidance} This is a pattern observation, not veterinary advice.`,
    currentLabel: `${pluralize(recentActiveDays, "active day")}`,
    baselineLabel: `${pluralize(baselineActiveDays, "active day")}`,
    direction: "stable",
    recommendation: "Keep logging for a few more days.",
  };
}

function buildSteadyInsight(params: {
  baselineActiveDays: number;
  recentActiveDays: number;
  dogName: string;
  base: BaselineConfidence;
}): HealthInsight {
  const { baselineActiveDays, recentActiveDays, dogName, base } = params;

  return {
    id: "patterns-steady",
    kind: "logging",
    severity: "info",
    confidence: base,
    title: "Patterns look steady",
    detail: `${dogName}'s feeding, water, walking and potty patterns are in line with ${BASELINE_DESCRIPTION} across ${pluralize(recentActiveDays, "recent active day")} and ${pluralize(baselineActiveDays, "baseline active day")}. This is a pattern observation, not veterinary advice.`,
    currentLabel: `${pluralize(recentActiveDays, "active day")}`,
    baselineLabel: `${pluralize(baselineActiveDays, "active day")}`,
    direction: "stable",
    recommendation: "Keep logging as usual.",
  };
}

function compareInsights(left: HealthInsight, right: HealthInsight): number {
  return (
    SEVERITY_RANK[right.severity] - SEVERITY_RANK[left.severity] ||
    CONFIDENCE_RANK[right.confidence] - CONFIDENCE_RANK[left.confidence] ||
    left.id.localeCompare(right.id)
  );
}

/**
 * Build a rule-based, explainable baseline for one dog.
 *
 * The recent window is [now - 3 days, now]. The baseline is the preceding
 * 14 days, ending exactly where the recent window starts so recent events
 * can never inflate the baseline. Active days are grouped by local calendar
 * date, while `window` exposes the exact ISO boundaries used for filtering.
 *
 * Eligibility: both windows need logged active days (5 baseline, 2 recent).
 * Per-active-day rates intentionally divide by days that actually have
 * events, rather than all 14 days, to reduce missing-log bias. Rates are
 * null only when a window has no active day at all.
 *
 * Pure and deterministic for a given dog, events, weight logs and now.
 * Events for other dogs, future timestamps and events outside both windows
 * are ignored. The output is descriptive only, never veterinary advice.
 */
export function buildHealthBaseline(
  dog: Dog,
  events: CareEvent[],
  weightLogs: WeightLog[],
  now: Date = new Date(),
): HealthBaselineReport {
  const reference = Number.isFinite(now.getTime()) ? now : new Date();
  const nowMs = reference.getTime();
  const recentStartMs = nowMs - RECENT_WINDOW_DAYS * DAY_MS;
  const baselineStartMs = recentStartMs - BASELINE_WINDOW_DAYS * DAY_MS;

  const recent = collectEvents({
    events,
    dogId: dog.dogId,
    startMs: recentStartMs,
    endMs: nowMs,
    endInclusive: true,
  });
  const baseline = collectEvents({
    events,
    dogId: dog.dogId,
    startMs: baselineStartMs,
    endMs: recentStartMs,
    endInclusive: false,
  });

  const recentWeights = collectWeights({
    weightLogs,
    dogId: dog.dogId,
    startMs: recentStartMs,
    endMs: nowMs,
    endInclusive: true,
  });
  const baselineWeights = collectWeights({
    weightLogs,
    dogId: dog.dogId,
    startMs: baselineStartMs,
    endMs: recentStartMs,
    endInclusive: false,
  });

  const baselineActiveDays = baseline.activeDayKeys.size;
  const recentActiveDays = recent.activeDayKeys.size;

  const baselineInterval = medianIntervalHours(baseline.toiletTimes);
  const recentInterval = medianIntervalHours(recent.toiletTimes);
  const baselineSuccessRate = successRate(baseline);
  const recentSuccessRate = successRate(recent);

  const baselineWeightMedian = median(
    baselineWeights.map((entry) => entry.weight),
  );
  const latestWeight =
    recentWeights.length > 0
      ? recentWeights[recentWeights.length - 1].weight
      : null;
  const weightChangePct =
    baselineWeightMedian !== null &&
    baselineWeightMedian > 0 &&
    latestWeight !== null
      ? roundTo(
          ((latestWeight - baselineWeightMedian) / baselineWeightMedian) * 100,
          1,
        )
      : null;

  const metrics: HealthBaselineMetrics = {
    baselineActiveDays,
    recentActiveDays,
    baselineFeedsPerActiveDay: roundNullable(
      ratePerActiveDay(baseline.feedCount, baselineActiveDays),
      2,
    ),
    recentFeedsPerActiveDay: roundNullable(
      ratePerActiveDay(recent.feedCount, recentActiveDays),
      2,
    ),
    baselineWaterPerActiveDay: roundNullable(
      ratePerActiveDay(baseline.waterCount, baselineActiveDays),
      2,
    ),
    recentWaterPerActiveDay: roundNullable(
      ratePerActiveDay(recent.waterCount, recentActiveDays),
      2,
    ),
    baselineWalksPerActiveDay: roundNullable(
      ratePerActiveDay(baseline.walkCount, baselineActiveDays),
      2,
    ),
    recentWalksPerActiveDay: roundNullable(
      ratePerActiveDay(recent.walkCount, recentActiveDays),
      2,
    ),
    baselineToiletsPerActiveDay: roundNullable(
      ratePerActiveDay(baseline.toiletTimes.length, baselineActiveDays),
      2,
    ),
    recentToiletsPerActiveDay: roundNullable(
      ratePerActiveDay(recent.toiletTimes.length, recentActiveDays),
      2,
    ),
    baselineAccidentsPerActiveDay: roundNullable(
      ratePerActiveDay(baseline.accidentCount, baselineActiveDays),
      2,
    ),
    recentAccidentsPerActiveDay: roundNullable(
      ratePerActiveDay(recent.accidentCount, recentActiveDays),
      2,
    ),
    baselinePottySuccessRate: roundNullable(baselineSuccessRate, 4),
    recentPottySuccessRate: roundNullable(recentSuccessRate, 4),
    baselinePottyIntervalHours: roundNullable(baselineInterval.hours, 1),
    recentPottyIntervalHours: roundNullable(recentInterval.hours, 1),
    baselineWeightKg: roundNullable(baselineWeightMedian, 2),
    latestWeightKg: roundNullable(latestWeight, 2),
    weightChangePct,
  };

  const sufficient =
    baselineActiveDays >= MIN_BASELINE_ACTIVE_DAYS &&
    recentActiveDays >= MIN_RECENT_ACTIVE_DAYS;

  const dataQuality: DataQuality = !sufficient
    ? "insufficient"
    : baselineActiveDays >= GOOD_BASELINE_ACTIVE_DAYS
      ? "good"
      : "limited";

  if (!sufficient) {
    const insights = [
      buildLoggingInsight({
        baselineActiveDays,
        recentActiveDays,
        dogName: dog.dogName,
      }),
    ];

    return {
      dogId: dog.dogId,
      generatedAt: reference.toISOString(),
      window: {
        recentStart: new Date(recentStartMs).toISOString(),
        recentEnd: new Date(nowMs).toISOString(),
        baselineStart: new Date(baselineStartMs).toISOString(),
        baselineEnd: new Date(recentStartMs).toISOString(),
        recentDays: RECENT_WINDOW_DAYS,
        baselineDays: BASELINE_WINDOW_DAYS,
      },
      dataQuality,
      metrics,
      insights,
      disclaimer: HEALTH_BASELINE_DISCLAIMER,
    };
  }

  const confidence = baseConfidence(
    baselineActiveDays,
    baseline.eventCount,
  );
  const candidates: HealthInsight[] = [];

  const feeding = buildRateInsight({
    kind: "feeding",
    label: "Feeding",
    idPrefix: "feeding-intake",
    recentCount: recent.feedCount,
    baselineCount: baseline.feedCount,
    recentActiveDays,
    baselineActiveDays,
    dogName: dog.dogName,
    base: confidence,
  });
  if (feeding) candidates.push(feeding);

  const water = buildRateInsight({
    kind: "water",
    label: "Water intake",
    idPrefix: "water-intake",
    recentCount: recent.waterCount,
    baselineCount: baseline.waterCount,
    recentActiveDays,
    baselineActiveDays,
    dogName: dog.dogName,
    base: confidence,
  });
  if (water) candidates.push(water);

  const walking = buildRateInsight({
    kind: "walking",
    label: "Walking activity",
    idPrefix: "walking-activity",
    recentCount: recent.walkCount,
    baselineCount: baseline.walkCount,
    recentActiveDays,
    baselineActiveDays,
    dogName: dog.dogName,
    base: confidence,
  });
  if (walking) candidates.push(walking);

  const accidents = buildAccidentInsight({
    recentAccidents: recent.accidentCount,
    baselineAccidents: baseline.accidentCount,
    recentActiveDays,
    baselineActiveDays,
    dogName: dog.dogName,
    base: confidence,
  });
  if (accidents) candidates.push(accidents);

  const successDrop = buildSuccessRateInsight({
    baselineRate: baselineSuccessRate,
    recentRate: recentSuccessRate,
    baselineClassified: baseline.successCount + baseline.accidentCount,
    recentClassified: recent.successCount + recent.accidentCount,
    dogName: dog.dogName,
    base: confidence,
  });
  if (successDrop) candidates.push(successDrop);

  const intervalChange = buildIntervalInsight({
    baselineHours: baselineInterval.hours,
    recentHours: recentInterval.hours,
    baselineIntervals: baselineInterval.count,
    recentIntervals: recentInterval.count,
    dogName: dog.dogName,
    base: confidence,
  });
  if (intervalChange) candidates.push(intervalChange);

  const weightChange = buildWeightInsight({
    baselineWeights,
    recentWeights,
    dogName: dog.dogName,
    base: confidence,
  });
  if (weightChange) candidates.push(weightChange);

  const insights =
    candidates.length > 0
      ? [...candidates].sort(compareInsights).slice(0, MAX_INSIGHTS)
      : [
          buildSteadyInsight({
            baselineActiveDays,
            recentActiveDays,
            dogName: dog.dogName,
            base: confidence,
          }),
        ];

  return {
    dogId: dog.dogId,
    generatedAt: reference.toISOString(),
    window: {
      recentStart: new Date(recentStartMs).toISOString(),
      recentEnd: new Date(nowMs).toISOString(),
      baselineStart: new Date(baselineStartMs).toISOString(),
      baselineEnd: new Date(recentStartMs).toISOString(),
      recentDays: RECENT_WINDOW_DAYS,
      baselineDays: BASELINE_WINDOW_DAYS,
    },
    dataQuality,
    metrics,
    insights,
    disclaimer: HEALTH_BASELINE_DISCLAIMER,
  };
}

function roundNullable(
  value: number | null,
  decimalPlaces: number,
): number | null {
  return value === null ? null : roundTo(value, decimalPlaces);
}

/**
 * Plain-text form for sharing or support exports. Lines are intentionally
 * short and include the current/baseline pair so the observation is
 * explainable without the rest of the report.
 */
export function formatHealthInsightForExport(
  insight: HealthInsight,
): string {
  return [
    `${insight.title} (${insight.severity}, ${insight.confidence} confidence)`,
    insight.detail,
    `Current: ${insight.currentLabel} | Baseline: ${insight.baselineLabel}`,
    `Next step: ${insight.recommendation}`,
  ].join("\n");
}
