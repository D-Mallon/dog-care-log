import { describe, expect, it } from "vitest";
import type { CareSchedule, CareTaskCompletion } from "../../types/core.ts";
import { getTodayPlan, toLocalDateKey } from "../schedules.ts";

// 9 November 2026 is a Monday; 14/15 November are Saturday/Sunday.
const MONDAY_NOON = new Date(2026, 10, 9, 12, 0, 0);
const TUESDAY_NOON = new Date(2026, 10, 10, 12, 0, 0);
const SATURDAY_NOON = new Date(2026, 10, 14, 12, 0, 0);
const SUNDAY_NOON = new Date(2026, 10, 15, 12, 0, 0);

let idCounter = 0;

function makeSchedule(overrides: Partial<CareSchedule> = {}): CareSchedule {
  idCounter += 1;
  return {
    id: `schedule-${idCounter}`,
    householdId: "household-1",
    dogId: "dog-1",
    type: "walk",
    title: "Morning walk",
    timeOfDay: "08:00",
    recurrence: "daily",
    active: true,
    createdBy: "user-1",
    ...overrides,
  };
}

function makeCompletion(
  overrides: Partial<CareTaskCompletion> = {},
): CareTaskCompletion {
  idCounter += 1;
  return {
    id: `completion-${idCounter}`,
    scheduleId: "schedule-1",
    dueDate: "2026-11-09",
    completedBy: "user-2",
    completedAt: "2026-11-09T08:15:00",
    ...overrides,
  };
}

describe("getTodayPlan", () => {
  it("returns an empty plan when there are no schedules", () => {
    expect(getTodayPlan([], [], MONDAY_NOON)).toEqual([]);
    expect(
      getTodayPlan([], [makeCompletion({ scheduleId: "missing" })], MONDAY_NOON),
    ).toEqual([]);
  });

  it("adds a daily schedule at today's local time and ignores inactive ones", () => {
    const daily = makeSchedule({ timeOfDay: "08:30" });
    const inactive = makeSchedule({ active: false });

    const tasks = getTodayPlan([daily, inactive], [], MONDAY_NOON);

    expect(tasks).toHaveLength(1);
    expect(tasks[0].schedule).toBe(daily);
    expect(tasks[0].status).toBe("overdue");
    expect(new Date(tasks[0].dueAt).getHours()).toBe(8);
    expect(new Date(tasks[0].dueAt).getMinutes()).toBe(30);
  });

  it("runs weekdays schedules only Monday to Friday", () => {
    const schedule = makeSchedule({ recurrence: "weekdays" });

    expect(getTodayPlan([schedule], [], MONDAY_NOON)).toHaveLength(1);
    expect(getTodayPlan([schedule], [], TUESDAY_NOON)).toHaveLength(1);
    expect(getTodayPlan([schedule], [], SATURDAY_NOON)).toEqual([]);
    expect(getTodayPlan([schedule], [], SUNDAY_NOON)).toEqual([]);
  });

  it("runs weekends schedules only on Saturday and Sunday", () => {
    const schedule = makeSchedule({ recurrence: "weekends" });

    expect(getTodayPlan([schedule], [], SATURDAY_NOON)).toHaveLength(1);
    expect(getTodayPlan([schedule], [], SUNDAY_NOON)).toHaveLength(1);
    expect(getTodayPlan([schedule], [], MONDAY_NOON)).toEqual([]);
  });

  it("runs weekly schedules on the weekday of startDate", () => {
    const schedule = makeSchedule({
      recurrence: "weekly",
      startDate: "2026-11-02",
    });

    expect(getTodayPlan([schedule], [], MONDAY_NOON)).toHaveLength(1);
    expect(getTodayPlan([schedule], [], TUESDAY_NOON)).toEqual([]);
    expect(getTodayPlan([schedule], [], SATURDAY_NOON)).toEqual([]);
  });

  it("falls back to the creation date for a weekly schedule's weekday", () => {
    const schedule = makeSchedule({
      recurrence: "weekly",
      createdAt: "2026-11-02T09:00:00",
    });

    expect(getTodayPlan([schedule], [], MONDAY_NOON)).toHaveLength(1);
    expect(getTodayPlan([schedule], [], TUESDAY_NOON)).toEqual([]);
  });

  it("runs once schedules only on their startDate", () => {
    const once = makeSchedule({
      recurrence: "once",
      startDate: "2026-11-09",
    });
    const withoutStart = makeSchedule({ recurrence: "once" });

    expect(getTodayPlan([once], [], MONDAY_NOON)).toHaveLength(1);
    expect(getTodayPlan([once], [], TUESDAY_NOON)).toEqual([]);
    expect(getTodayPlan([withoutStart], [], MONDAY_NOON)).toEqual([]);
  });

  it("marks a task done from today's matching completion", () => {
    const schedule = makeSchedule({ timeOfDay: "08:00" });
    const completion = makeCompletion({
      scheduleId: schedule.id,
      dueDate: "2026-11-09",
      completedBy: "user-3",
      completedAt: "2026-11-09T08:10:00",
    });

    const [task] = getTodayPlan([schedule], [completion], MONDAY_NOON);

    // Done wins over the fact that the due time has already passed.
    expect(task.status).toBe("done");
    expect(task.completedBy).toBe("user-3");
    expect(task.completedAt).toBe("2026-11-09T08:10:00");
  });

  it("ignores completions for a different local due date", () => {
    const schedule = makeSchedule({ timeOfDay: "08:00" });
    const completion = makeCompletion({
      scheduleId: schedule.id,
      dueDate: "2026-11-08",
    });

    const [task] = getTodayPlan([schedule], [completion], MONDAY_NOON);

    expect(task.status).toBe("overdue");
    expect(task.completedBy).toBeUndefined();
  });

  it("classifies overdue and upcoming tasks relative to now", () => {
    const overdue = makeSchedule({ timeOfDay: "08:00" });
    const exact = makeSchedule({ timeOfDay: "12:00" });
    const upcoming = makeSchedule({ timeOfDay: "18:00" });

    const tasks = getTodayPlan([overdue, exact, upcoming], [], MONDAY_NOON);
    const statusById = new Map(
      tasks.map((task) => [task.schedule.id, task.status]),
    );

    expect(statusById.get(overdue.id)).toBe("overdue");
    expect(statusById.get(exact.id)).toBe("upcoming");
    expect(statusById.get(upcoming.id)).toBe("upcoming");
  });

  it("respects inclusive start and end date bounds", () => {
    const inside = makeSchedule({
      startDate: "2026-11-09",
      endDate: "2026-11-09",
    });
    const startsTomorrow = makeSchedule({ startDate: "2026-11-10" });
    const endedYesterday = makeSchedule({ endDate: "2026-11-08" });

    const tasks = getTodayPlan(
      [inside, startsTomorrow, endedYesterday],
      [],
      MONDAY_NOON,
    );

    expect(tasks.map((task) => task.schedule.id)).toEqual([inside.id]);
  });

  it("sorts by status group first, then due time", () => {
    const done = makeSchedule({ id: "done", timeOfDay: "07:00" });
    const overdue = makeSchedule({ id: "overdue", timeOfDay: "09:00" });
    const upcomingEarly = makeSchedule({
      id: "upcoming-early",
      timeOfDay: "10:00",
    });
    const upcomingLate = makeSchedule({
      id: "upcoming-late",
      timeOfDay: "18:00",
    });

    const completion = makeCompletion({
      scheduleId: done.id,
      dueDate: "2026-11-09",
    });

    const tasks = getTodayPlan(
      [done, overdue, upcomingEarly, upcomingLate],
      [completion],
      MONDAY_NOON,
    );

    expect(tasks.map((task) => task.schedule.id)).toEqual([
      "overdue",
      "upcoming-early",
      "upcoming-late",
      "done",
    ]);
  });

  it("formats the local due date key used by completions", () => {
    expect(toLocalDateKey(MONDAY_NOON)).toBe("2026-11-09");
  });

  it("skips schedules with missing or invalid timeOfDay instead of throwing", () => {
    const invalid = [
      makeSchedule({ timeOfDay: "25:00" }),
      makeSchedule({ timeOfDay: "12:75" }),
      makeSchedule({ timeOfDay: "not-a-time" }),
      makeSchedule({ timeOfDay: "" }),
    ];

    expect(getTodayPlan(invalid, [], MONDAY_NOON)).toEqual([]);
  });
});
