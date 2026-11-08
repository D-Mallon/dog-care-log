import type { CareEvent } from "../types/core.ts";
import { formatDurationHours, hoursBetween } from "./dates.ts";

export type PeeStatus = "overdue" | "due-soon" | "upcoming" | "unknown";

export type PottyInsights = {
  sampleSize: number;
  peeEventCount: number;
  medianPeeIntervalHours: number | null;
  lastPeeAt: string | null;
  nextPeeDueAt: string | null;
  peeStatus: PeeStatus;
  hoursUntilDue: number | null;
  accidentCount: number;
  averageAccidentHoursAfterToilet: number | null;
  morningPooAverageTime: string | null;
  morningPooCount: number;
  summary: string[];
};

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function minutesSinceMidnight(iso: string): number {
  const date = new Date(iso);
  return date.getHours() * 60 + date.getMinutes();
}

function formatMinutesSinceMidnight(totalMinutes: number): string {
  const normalised = ((Math.round(totalMinutes) % 1440) + 1440) % 1440;
  const hours = Math.floor(normalised / 60);
  const minutes = normalised % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function formatPeeDue(
  status: PeeStatus,
  hoursUntilDue: number | null,
): string {
  if (status === "unknown" || hoursUntilDue === null) {
    return "Not enough recent data to predict the next pee yet.";
  }
  const duration = formatDurationHours(Math.abs(hoursUntilDue));
  if (status === "overdue") {
    return `Next pee is likely overdue by ~${duration}.`;
  }
  if (status === "due-soon") {
    return `Next pee is likely due within ~${duration}.`;
  }
  return `Next pee is likely due in ~${duration}.`;
}

/**
 * Heuristic potty analysis for the last seven days.
 *
 * The due time is last pee + median interval, not "now + average interval".
 * A minimum of three toilet events is required before showing anything.
 */
export function getPottyInsights(
  events: CareEvent[],
  now: Date = new Date(),
): PottyInsights | null {
  const nowMs = now.getTime();
  const windowStart = nowMs - 7 * DAY_MS;

  const recentToiletEvents = events
    .filter((event) => {
      if (event.type !== "toilet") return false;
      const timestamp = new Date(event.timestamp).getTime();
      return (
        Number.isFinite(timestamp) &&
        timestamp >= windowStart &&
        timestamp <= nowMs
      );
    })
    .sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );

  if (recentToiletEvents.length < 3) return null;

  const peeEvents = recentToiletEvents.filter(
    (event) => event.subtype === "pee",
  );

  const peeIntervals: number[] = [];
  for (let index = 1; index < peeEvents.length; index += 1) {
    const previous = new Date(peeEvents[index - 1].timestamp).getTime();
    const current = new Date(peeEvents[index].timestamp).getTime();
    const intervalHours = (current - previous) / HOUR_MS;
    // Ignore duplicate/accidental same-minute records and implausibly long gaps.
    if (intervalHours >= 0.25 && intervalHours <= 24) {
      peeIntervals.push(intervalHours);
    }
  }

  const medianPeeIntervalHours =
    peeIntervals.length > 0 ? Math.round(median(peeIntervals) * 10) / 10 : null;
  const lastPee = peeEvents[peeEvents.length - 1] ?? null;
  const nextPeeDueAt =
    lastPee && medianPeeIntervalHours !== null
      ? new Date(
          new Date(lastPee.timestamp).getTime() +
            medianPeeIntervalHours * HOUR_MS,
        ).toISOString()
      : null;

  let hoursUntilDue: number | null = null;
  let peeStatus: PeeStatus = "unknown";

  if (nextPeeDueAt) {
    hoursUntilDue = Math.round(
      ((new Date(nextPeeDueAt).getTime() - nowMs) / HOUR_MS) * 10,
    ) / 10;
    if (hoursUntilDue < 0) {
      peeStatus = "overdue";
    } else if (hoursUntilDue <= 1) {
      peeStatus = "due-soon";
    } else {
      peeStatus = "upcoming";
    }
  }

  const accidents = recentToiletEvents.filter((event) => event.isAccident);
  const accidentIntervals: number[] = [];
  for (const accident of accidents) {
    const accidentTime = new Date(accident.timestamp).getTime();
    const prior = recentToiletEvents.filter(
      (event) =>
        event.id !== accident.id &&
        new Date(event.timestamp).getTime() < accidentTime,
    );
    const lastPrior = prior[prior.length - 1];
    if (lastPrior) {
      const hours = hoursBetween(lastPrior.timestamp, accident.timestamp);
      if (hours >= 0 && hours <= 24) accidentIntervals.push(hours);
    }
  }

  const averageAccidentHoursAfterToilet =
    accidentIntervals.length > 0
      ? Math.round(
          (accidentIntervals.reduce((sum, value) => sum + value, 0) /
            accidentIntervals.length) *
            10,
        ) / 10
      : null;

  const morningPoos = recentToiletEvents.filter((event) => {
    if (event.subtype !== "poo") return false;
    const hour = new Date(event.timestamp).getHours();
    return hour >= 5 && hour <= 10;
  });

  const morningPooAverageTime =
    morningPoos.length > 0
      ? formatMinutesSinceMidnight(
          morningPoos.reduce(
            (sum, event) => sum + minutesSinceMidnight(event.timestamp),
            0,
          ) / morningPoos.length,
        )
      : null;

  const summary: string[] = [formatPeeDue(peeStatus, hoursUntilDue)];

  if (
    averageAccidentHoursAfterToilet !== null &&
    accidents.length >= 2
  ) {
    summary.push(
      `Accidents tend to happen around ${formatDurationHours(
        averageAccidentHoursAfterToilet,
      )} after the last toilet break (${accidents.length} accidents in 7 days).`,
    );
  }

  if (morningPooAverageTime) {
    summary.push(
      `Morning poo routine is usually around ${morningPooAverageTime} (${morningPoos.length} logged).`,
    );
  }

  return {
    sampleSize: recentToiletEvents.length,
    peeEventCount: peeEvents.length,
    medianPeeIntervalHours,
    lastPeeAt: lastPee?.timestamp ?? null,
    nextPeeDueAt,
    peeStatus,
    hoursUntilDue,
    accidentCount: accidents.length,
    averageAccidentHoursAfterToilet,
    morningPooAverageTime,
    morningPooCount: morningPoos.length,
    summary,
  };
}
