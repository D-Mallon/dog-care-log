import { supabase } from "./supabase.ts";
import type {
  CareSchedule,
  CareTaskCompletion,
  EventType,
  ScheduleRecurrence,
} from "../types/core.ts";

export type NewScheduleInput = {
  householdId: string;
  dogId: string;
  type: EventType;
  title: string;
  timeOfDay: string;
  recurrence: ScheduleRecurrence;
  assignedTo?: string | null;
  createdBy: string;
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

export async function createSchedule(
  input: NewScheduleInput,
): Promise<CareSchedule> {
  const schedule: CareSchedule = {
    id: crypto.randomUUID(),
    householdId: input.householdId,
    dogId: input.dogId,
    type: input.type,
    title: input.title.trim(),
    timeOfDay: input.timeOfDay,
    recurrence: input.recurrence,
    active: true,
    assignedTo: input.assignedTo ?? undefined,
    createdBy: input.createdBy,
    startDate: input.startDate,
    endDate: input.endDate ?? undefined,
  };

  const { data, error } = await supabase
    .from("CareSchedule")
    .insert(schedule)
    .select()
    .single();

  if (error) throw error;
  return data as CareSchedule;
}

export async function updateSchedule(
  scheduleId: string,
  updates: Partial<
    Pick<
      CareSchedule,
      | "type"
      | "title"
      | "timeOfDay"
      | "recurrence"
      | "active"
      | "assignedTo"
      | "startDate"
      | "endDate"
    >
  >,
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

export async function deleteSchedule(scheduleId: string): Promise<void> {
  const { error } = await supabase
    .from("CareSchedule")
    .delete()
    .eq("id", scheduleId);
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

export async function setTaskCompletion(
  scheduleId: string,
  dueDate: string,
  completed: boolean,
  userId: string,
): Promise<void> {
  if (completed) {
    const { error } = await supabase
      .from("CareTaskCompletion")
      .upsert(
        {
          id: crypto.randomUUID(),
          scheduleId,
          dueDate,
          completedBy: userId,
          completedAt: new Date().toISOString(),
        },
        { onConflict: "scheduleId,dueDate" },
      );
    if (error) throw error;
    return;
  }

  const { error } = await supabase
    .from("CareTaskCompletion")
    .delete()
    .eq("scheduleId", scheduleId)
    .eq("dueDate", dueDate);
  if (error) throw error;
}
