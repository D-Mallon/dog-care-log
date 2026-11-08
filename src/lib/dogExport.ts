import type { CareEvent, Dog, WeightLog } from "../types/core.ts";
import {
  rowsToCsv,
  safeFilename,
  withUtf8Bom,
  type CsvValue,
} from "./csv.ts";

type EventLabels = Record<string, string>;

function sortByTimestamp<T>(
  items: T[],
  getTimestamp: (item: T) => string,
): T[] {
  return [...items].sort(
    (a, b) =>
      new Date(getTimestamp(a)).getTime() -
      new Date(getTimestamp(b)).getTime(),
  );
}

export function buildDogExportRows(
  dog: Dog,
  events: CareEvent[],
  weightLogs: WeightLog[],
  eventLabels: EventLabels,
): CsvValue[][] {
  const rows: CsvValue[][] = [];

  rows.push(["Loggi export", dog.dogName]);
  rows.push(["Exported", new Date().toISOString()]);
  rows.push([]);

  rows.push(["Dog info"]);
  rows.push(["Name", "Breed", "Age (years)", "Current weight (kg)", "Notes"]);
  rows.push([
    dog.dogName,
    dog.breed ?? "",
    dog.age ?? "",
    dog.weight ?? "",
    dog.notes ?? "",
  ]);
  rows.push([]);

  rows.push(["Care events"]);
  rows.push([
    "Timestamp (UTC)",
    "Type",
    "Subtype",
    "Accident",
    "Note",
    "Logged by user ID",
  ]);

  for (const event of sortByTimestamp(events, (item) => item.timestamp)) {
    rows.push([
      event.timestamp,
      eventLabels[event.type] ?? event.type,
      event.subtype ?? "",
      event.isAccident ? "Yes" : "No",
      event.note ?? "",
      event.userId,
    ]);
  }

  rows.push([]);
  rows.push(["Weight history"]);
  rows.push(["Recorded at (UTC)", "Weight (kg)", "Logged by user ID"]);

  for (const weight of sortByTimestamp(
    weightLogs,
    (item) => item.recordedAt,
  )) {
    rows.push([
      weight.recordedAt,
      weight.weight,
      weight.userId ?? "",
    ]);
  }

  return rows;
}

export function buildDogExportCsv(
  dog: Dog,
  events: CareEvent[],
  weightLogs: WeightLog[],
  eventLabels: EventLabels,
): string {
  return withUtf8Bom(
    `${rowsToCsv(buildDogExportRows(dog, events, weightLogs, eventLabels))}\r\n`,
  );
}

export function dogExportFilename(dogName: string): string {
  return `${safeFilename(dogName)}_loggi_export.csv`;
}
