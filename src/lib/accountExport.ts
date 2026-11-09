import type { CareEvent, Dog, WeightLog } from "../types/core.ts";
import { buildDogExportRows } from "./dogExport.ts";
import { rowsToCsv, withUtf8Bom, type CsvValue } from "./csv.ts";

/**
 * One CSV containing every dog in the household, its events and its weight
 * history. Each dog block reuses the same format as the per-dog export.
 */
export function buildAccountExportCsv(
  dogs: Dog[],
  events: CareEvent[],
  weightLogs: WeightLog[],
  eventLabels: Record<string, string>,
): string {
  const rows: CsvValue[][] = [
    ["Loggi household export"],
    ["Exported", new Date().toISOString()],
    ["Dog count", dogs.length],
    [],
  ];

  for (const dog of dogs) {
    rows.push([`Dog: ${dog.dogName}`]);
    rows.push(
      ...buildDogExportRows(
        dog,
        events.filter((event) => event.dogId === dog.dogId),
        weightLogs.filter((weight) => weight.dogId === dog.dogId),
        eventLabels,
      ),
    );
    rows.push([]);
  }

  return withUtf8Bom(`${rowsToCsv(rows)}\r\n`);
}

export function accountExportFilename(): string {
  const date = new Date().toISOString().slice(0, 10);
  return `loggi_household_export_${date}.csv`;
}
