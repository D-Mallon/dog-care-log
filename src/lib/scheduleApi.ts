import { supabase } from "./supabase.ts";
import type {
  CareSchedule,
  CareTaskCompletion,
  EventType,
  ScheduleRecurrence,
} from "../types/core.ts";
import { toLocalDateKey } from "./schedules.ts";

export type NewScheduleInput = {
  householdId: string;
  dogIds: string[];
  type: EventType;
  title: string;
  timeOfDay: string;
  recurrence: ScheduleRecurrence;
  assignedTo?: string | null;
  createdBy: string;
  startDate?: string;
  endDate?: string | null;
};

export type ScheduleUpdates = {
  type?: EventType;
  title?: string;
  timeOfDay?: string;
  recurrence?: ScheduleRecurrence;
  active?: boolean;
  assignedTo?: string | null;
  startDate?: string;
  endDate?: string | null;
};

export async function listSchedules(
  householdId: string,
): Promise<CareSchedule[]> {
  const { data, error } = await supabase
    .from("CareSchedule")
    .select("*")
    .eq("householdId", householdId)
    .order("timeOfDay", { ascending: true });

  if (error) throw error;
  return (data ?? []) as CareSchedule[];
}

/**
 * Create one routine that applies to one or more dogs.
 *
 * The database still stores one CareSchedule row per dog (keeping the existing
 * per-dog RLS and reporting model), but all rows share a groupId so the UI can
 * treat them as one task and complete them together.
 */
export async function createScheduleGroup(
  input: NewScheduleInput,
): Promise<CareSchedule[]> {
  if (input.dogIds.length === 0) {
    throw new Error("Choose at least one dog.");
  }

  const groupId = crypto.randomUUID();
  const now = new Date().toISOString();
  const rows = input.dogIds.map((dogId) => ({
    id: crypto.randomUUID(),
    householdId: input.householdId,
    groupId,
    dogId,
    type: input.type,
    title: input.title.trim(),
    timeOfDay: input.timeOfDay,
    recurrence: input.recurrence,
    active: true,
    assignedTo: input.assignedTo ?? null,
    createdBy: input.createdBy,
    createdAt: now,
    // Do not rely on the production column default: older schemas were
    // created without one, so an omitted date fails the NOT NULL constraint.
    startDate: input.startDate ?? toLocalDateKey(new Date()),
    endDate: input.endDate ?? null,
  }));

  const { data, error } = await supabase
    .from("CareSchedule")
    .insert(rows)
    .select();

  if (error) throw error;
  return (data ?? []) as CareSchedule[];
}

async function getScheduleGroup(groupId: string): Promise<CareSchedule[]> {
  const { data, error } = await supabase
    .from("CareSchedule")
    .select("*")
    .eq("groupId", groupId)
    .order("dogId", { ascending: true });

  if (error) throw error;
  return (data ?? []) as CareSchedule[];
}

/**
 * Update a routine group, optionally adding/removing dogs.
 *
 * Removed dogs lose their schedule rows (and therefore their completions via
 * cascade). New dogs get a row with the same groupId and the common fields.
 */
export async function updateScheduleGroup(
  groupId: string,
  updates: ScheduleUpdates,
  dogIds?: string[],
): Promise<CareSchedule[]> {
  const existing = await getScheduleGroup(groupId);
  if (existing.length === 0) {
    throw new Error("That routine no longer exists.");
  }

  const base = existing[0];
  const targetDogIds = dogIds ?? existing.map((schedule) => schedule.dogId);
  if (targetDogIds.length === 0) {
    throw new Error("Choose at least one dog.");
  }

  const { error: updateError } = await supabase
    .from("CareSchedule")
    .update(updates)
    .eq("groupId", groupId);
  if (updateError) throw updateError;

  const existingDogIds = new Set(existing.map((schedule) => schedule.dogId));
  const removed = existing.filter(
    (schedule) => !targetDogIds.includes(schedule.dogId),
  );

  for (const schedule of removed) {
    const { error } = await supabase
      .from("CareSchedule")
      .delete()
      .eq("id", schedule.id);
    if (error) throw error;
  }

  const added = targetDogIds.filter((dogId) => !existingDogIds.has(dogId));
  if (added.length > 0) {
    const rows = added.map((dogId) => ({
      id: crypto.randomUUID(),
      householdId: base.householdId,
      groupId,
      dogId,
      type: updates.type ?? base.type,
      title: (updates.title ?? base.title).trim(),
      timeOfDay: updates.timeOfDay ?? base.timeOfDay,
      recurrence: updates.recurrence ?? base.recurrence,
      active: updates.active ?? base.active,
      assignedTo:
        updates.assignedTo !== undefined
          ? updates.assignedTo
          : (base.assignedTo ?? null),
      createdBy: base.createdBy,
      createdAt: new Date().toISOString(),
      startDate: updates.startDate ?? base.startDate,
      endDate:
        updates.endDate !== undefined ? updates.endDate : (base.endDate ?? null),
    }));

    const { error } = await supabase.from("CareSchedule").insert(rows);
    if (error) throw error;
  }

  return getScheduleGroup(groupId);
}

/** Update one existing row; used for activity toggles and assignments. */
export async function updateSchedule(
  scheduleId: string,
  updates: ScheduleUpdates,
): Promise<CareSchedule> {
  const { data, error } = await supabase
    .from("CareSchedule")
    .update(updates)
    .eq("id", scheduleId)
    .select()
    .single();

  if (error) throw error;
  return data as CareSchedule;
}

export async function deleteScheduleGroup(groupId: string): Promise<void> {
  const { error } = await supabase
    .from("CareSchedule")
    .delete()
    .eq("groupId", groupId);
  if (error) throw error;
}

export async function listCompletions(
  scheduleIds: string[],
  fromDate: string,
  toDate: string,
): Promise<CareTaskCompletion[]> {
  if (scheduleIds.length === 0) return [];

  const { data, error } = await supabase
    .from("CareTaskCompletion")
    .select("*")
    .in("scheduleId", scheduleIds)
    .gte("dueDate", fromDate)
    .lte("dueDate", toDate);

  if (error) throw error;
  return (data ?? []) as CareTaskCompletion[];
}

/**
 * Complete or uncomplete a whole routine group for one due date.
 *
 * One statement per operation keeps a group atomic: either every dog's
 * completion is written, or none is.
 */
export async function setTaskGroupCompletion(
  scheduleIds: string[],
  dueDate: string,
  completed: boolean,
  userId: string,
): Promise<void> {
  if (scheduleIds.length === 0) return;

  if (completed) {
    const { error } = await supabase.from("CareTaskCompletion").upsert(
      scheduleIds.map((scheduleId) => ({
        id: crypto.randomUUID(),
        scheduleId,
        dueDate,
        completedBy: userId,
        completedAt: new Date().toISOString(),
      })),
      { onConflict: "scheduleId,dueDate" },
    );
    if (error) throw error;
    return;
  }

  const { error } = await supabase
    .from("CareTaskCompletion")
    .delete()
    .in("scheduleId", scheduleIds)
    .eq("dueDate", dueDate);
  if (error) throw error;
}

/** Single-schedule wrapper, kept for callers that only need one row. */
export async function setTaskCompletion(
  scheduleId: string,
  dueDate: string,
  completed: boolean,
  userId: string,
): Promise<void> {
  return setTaskGroupCompletion([scheduleId], dueDate, completed, userId);
}
