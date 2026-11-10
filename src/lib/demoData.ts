import { supabase } from "./supabase.ts";
import type { CareEvent, Dog, EventType } from "../types/core.ts";

export function isDemoDog(dog: Pick<Dog, "dogName" | "notes">): boolean {
  return (
    dog.notes?.toLowerCase().includes("demo") === true ||
    dog.dogName.toLowerCase().includes("(demo)")
  );
}

type DemoEvent = Omit<CareEvent, "timestamp"> & { timestamp: string };

function localTimestamp(day: Date, hours: number, minutes = 0): string {
  const date = new Date(day);
  date.setHours(hours, minutes, 0, 0);
  return date.toISOString();
}

/**
 * Rebuilds the synthetic demo history for a demo dog. It only touches events
 * and weights for that dog; the dog, schedules and household are preserved.
 */
export async function resetDemoData(dog: Dog, userId: string): Promise<void> {
  if (!isDemoDog(dog)) throw new Error("This is not a demo dog.");

  const { error: eventDeleteError } = await supabase
    .from("DogEvent")
    .delete()
    .eq("dogId", dog.dogId);
  if (eventDeleteError) throw eventDeleteError;

  const { error: weightDeleteError } = await supabase
    .from("WeightLog")
    .delete()
    .eq("dogId", dog.dogId);
  if (weightDeleteError) throw weightDeleteError;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const events: DemoEvent[] = [];

  const add = (
    dayOffset: number,
    hour: number,
    minute: number,
    type: EventType,
    extra: Partial<CareEvent> = {},
  ) => {
    const day = new Date(today);
    day.setDate(day.getDate() + dayOffset);
    events.push({
      id: crypto.randomUUID(),
      dogId: dog.dogId,
      type,
      timestamp: localTimestamp(day, hour, minute),
      userId,
      note: "Demo data",
      ...extra,
    });
  };

  for (let offset = -17; offset <= -4; offset += 1) {
    for (const hour of [8, 18]) add(offset, hour, 0, "feed");
    for (const hour of [9, 17]) add(offset, hour, 15, "walk");
    for (const hour of [7, 12, 16, 21]) {
      add(offset, hour, 30, "toilet", {
        subtype: "pee",
        isAccident: false,
        pottyOutcome: "success",
        pottyLocation: "outside",
        pottyCue: "asked",
      });
    }
    for (const hour of [10, 15]) add(offset, hour, 45, "water");
  }

  for (let offset = -3; offset <= 0; offset += 1) {
    add(offset, 7, 30, "feed");
    add(offset, 8, 10, "walk");
    add(offset, 12, 0, "toilet", {
      subtype: "pee",
      isAccident: false,
      pottyOutcome: "success",
      pottyLocation: "outside",
      pottyCue: "asked",
    });
    add(offset, 14, 0, "toilet", {
      subtype: "pee",
      isAccident: true,
      pottyOutcome: "accident",
      pottyLocation: "indoor",
      pottyCue: "none",
    });
    add(offset, 18, 30, "toilet", {
      subtype: "pee",
      isAccident: true,
      pottyOutcome: "accident",
      pottyLocation: "indoor",
      pottyCue: "none",
    });
    add(offset, 8, 45, "water");
    add(offset, 17, 45, "water");
  }

  const { error: eventInsertError } = await supabase
    .from("DogEvent")
    .insert(events);
  if (eventInsertError) throw eventInsertError;

  const weights = [18.6, 18.4, 18.2, 17.7].map((weight, index) => ({
    id: crypto.randomUUID(),
    dogId: dog.dogId,
    weight,
    recordedAt: localTimestamp(
      new Date(today.getTime() - (14 - index * 4) * 86400000),
      8,
    ),
    userId,
  }));

  const { error: weightInsertError } = await supabase
    .from("WeightLog")
    .insert(weights);
  if (weightInsertError) throw weightInsertError;

  const { error: dogUpdateError } = await supabase
    .from("Dogs")
    .update({ weight: 17.7 })
    .eq("dogId", dog.dogId);
  if (dogUpdateError) throw dogUpdateError;
}
