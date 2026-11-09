import type { CareSchedule, CareTaskCompletion } from "../types/core.ts";

export type TodayTaskStatus = "done" | "overdue" | "upcoming";

export interface TodayTask {
  schedule: CareSchedule;
  /** Local "today" at the schedule's timeOfDay, as an ISO timestamp. */
  dueAt: string;
  status: TodayTaskStatus;
  completedAt?: string;
  completedBy?: string;
}

type TimeOfDay = {
  hours: number;
  minutes: number;
};

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^(\d{1,2}):(\d{2})(?::\d{2})?$/;

const STATUS_ORDER: Record<TodayTaskStatus, number> = {
  overdue: 0,
  upcoming: 1,
  done: 2,
};

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/**
 * Format a Date as a YYYY-MM-DD key in the user's local time.
 *
 * Use this for `CareTaskCompletion.dueDate` (the database column is a local
 * calendar date), rather than slicing an ISO timestamp which is UTC-based.
 */
export function toLocalDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}`;
}

/**
 * Normalise a date-ish string to a local YYYY-MM-DD key.
 *
 * Date-only values are treated as local calendar dates. Timestamp values are
 * parsed as instants and converted to their local calendar date. Invalid
 * values return null rather than throwing.
 */
function toDateKey(value: string | undefined): string | null {
  if (!value) return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  const dateOnlyMatch = DATE_ONLY_PATTERN.exec(trimmed);
  if (dateOnlyMatch) {
    const year = Number(dateOnlyMatch[1]);
    const month = Number(dateOnlyMatch[2]);
    const day = Number(dateOnlyMatch[3]);
    const date = new Date(year, month - 1, day);

    // Reject impossible dates like 2026-02-31.
    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      return null;
    }

    return `${dateOnlyMatch[1]}-${dateOnlyMatch[2]}-${dateOnlyMatch[3]}`;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return toLocalDateKey(parsed);
}

/** Parse an "HH:mm" (or "H:mm", "HH:mm:ss") value. Invalid input returns null. */
function parseTimeOfDay(value: string | undefined): TimeOfDay | null {
  if (!value) return null;

  const match = TIME_PATTERN.exec(value.trim());
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;

  return { hours, minutes };
}

function getWeekday(dateKey: string): number {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day).getDay();
}

/**
 * Whether a schedule should produce a task on the supplied local date,
 * respecting its recurrence, active flag and start/end date bounds.
 */
function isDueOnDate(schedule: CareSchedule, dateKey: string): boolean {
  if (!schedule.active) return false;

  const startDate = toDateKey(schedule.startDate);
  const endDate = toDateKey(schedule.endDate);

  // Bounds are inclusive. Invalid bounds are ignored rather than hiding tasks.
  if (startDate && dateKey < startDate) return false;
  if (endDate && dateKey > endDate) return false;

  switch (schedule.recurrence) {
    case "daily":
      return true;

    case "weekdays": {
      const weekday = getWeekday(dateKey);
      return weekday >= 1 && weekday <= 5;
    }

    case "weekends": {
      const weekday = getWeekday(dateKey);
      return weekday === 0 || weekday === 6;
    }

    case "weekly": {
      // Weekly repeats on the weekday of startDate, falling back to the
      // creation date. If neither is available, treat today as the anchor.
      const anchor = startDate ?? toDateKey(schedule.createdAt) ?? dateKey;
      if (!startDate) {
        const createdAt = toDateKey(schedule.createdAt);
        if (createdAt && dateKey < createdAt) return false;
      }
      return getWeekday(anchor) === getWeekday(dateKey);
    }

    case "once":
      return startDate === dateKey;

    default:
      return false;
  }
}

function completedAtTime(completion: CareTaskCompletion): number {
  const parsed = new Date(completion.completedAt).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * Index today's completions by schedule id, keeping the latest completion when
 * more than one exists.
 */
function buildCompletionIndex(
  completions: CareTaskCompletion[],
  todayKey: string,
): Map<string, CareTaskCompletion> {
  const index = new Map<string, CareTaskCompletion>();

  for (const completion of completions) {
    if (!completion?.scheduleId) continue;
    if (toDateKey(completion.dueDate) !== todayKey) continue;

    const existing = index.get(completion.scheduleId);
    if (!existing || completedAtTime(completion) >= completedAtTime(existing)) {
      index.set(completion.scheduleId, completion);
    }
  }

  return index;
}

function compareTasks(a: TodayTask, b: TodayTask): number {
  const statusOrder = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
  if (statusOrder !== 0) return statusOrder;

  const dueOrder = new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
  if (dueOrder !== 0) return dueOrder;

  const titleOrder = (a.schedule.title ?? "").localeCompare(
    b.schedule.title ?? "",
  );
  if (titleOrder !== 0) return titleOrder;

  return a.schedule.id.localeCompare(b.schedule.id);
}

/**
 * Build today's care plan from recurring schedules and today's completions.
 *
 * Pure: it never reads from the database, storage or the system clock unless
 * `now` is omitted. Every matching schedule yields at most one task.
 */
export function getTodayPlan(
  schedules: CareSchedule[],
  completions: CareTaskCompletion[],
  now: Date = new Date(),
): TodayTask[] {
  if (!schedules?.length) return [];

  const current = Number.isNaN(now.getTime()) ? new Date() : now;
  const todayKey = toLocalDateKey(current);
  const completionIndex = buildCompletionIndex(completions ?? [], todayKey);

  const tasks: TodayTask[] = [];

  for (const schedule of schedules) {
    if (!schedule?.id) continue;
    if (!isDueOnDate(schedule, todayKey)) continue;

    const timeOfDay = parseTimeOfDay(schedule.timeOfDay);
    if (!timeOfDay) continue;

    const dueAt = new Date(
      current.getFullYear(),
      current.getMonth(),
      current.getDate(),
      timeOfDay.hours,
      timeOfDay.minutes,
      0,
      0,
    );

    const completion = completionIndex.get(schedule.id);
    const status: TodayTaskStatus = completion
      ? "done"
      : dueAt.getTime() < current.getTime()
        ? "overdue"
        : "upcoming";

    const task: TodayTask = {
      schedule,
      dueAt: dueAt.toISOString(),
      status,
    };

    if (completion) {
      task.completedAt = completion.completedAt;
      task.completedBy = completion.completedBy;
    }

    tasks.push(task);
  }

  return tasks.sort(compareTasks);
}
