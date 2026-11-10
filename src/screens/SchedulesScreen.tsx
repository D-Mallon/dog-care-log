import { useState } from "react";
import type {
  CareSchedule,
  Dog,
  EventType,
  HouseholdMember,
  ScheduleRecurrence,
} from "../types/core.ts";
import { EVENT_DISPLAY } from "../lib/eventMeta.ts";
import {
  createSchedule,
  deleteSchedule,
  updateSchedule,
} from "../lib/scheduleApi.ts";

type SchedulesScreenProps = {
  householdId: string;
  dogs: Dog[];
  members: HouseholdMember[];
  currentUserId: string;
  schedules: CareSchedule[];
  onChanged: () => void;
  onBack: () => void;
};

const inputClass =
  "w-full rounded-xl border border-warm-brown/20 bg-cream px-3 py-2.5 text-sm text-text-dark focus:outline-none focus:border-warm-brown";
const labelClass =
  "mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted";

const EVENT_TYPES: EventType[] = [
  "feed",
  "water",
  "walk",
  "toilet",
  "meds",
  "play_time",
  "grooming",
];

const RECURRENCES: { value: ScheduleRecurrence; label: string }[] = [
  { value: "daily", label: "Every day" },
  { value: "weekdays", label: "Weekdays" },
  { value: "weekends", label: "Weekends" },
  { value: "weekly", label: "Weekly" },
  { value: "once", label: "Once" },
];

function memberName(
  members: HouseholdMember[],
  userId?: string | null,
): string {
  if (!userId) return "Anyone";
  const member = members.find((item) => item.userId === userId);
  return member?.displayName?.trim() || "Household member";
}

export default function SchedulesScreen({
  householdId,
  dogs,
  members,
  currentUserId,
  schedules,
  onChanged,
  onBack,
}: SchedulesScreenProps) {
  const [dogId, setDogId] = useState(dogs[0]?.dogId ?? "");
  const [type, setType] = useState<EventType>("feed");
  const [title, setTitle] = useState("");
  const [timeOfDay, setTimeOfDay] = useState("08:00");
  const [recurrence, setRecurrence] =
    useState<ScheduleRecurrence>("daily");
  const [assignedTo, setAssignedTo] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dogId) {
      setError("Add a dog before creating a schedule.");
      return;
    }

    setPending(true);
    setError(null);
    try {
      await createSchedule({
        householdId,
        dogId,
        type,
        title: title.trim() || EVENT_DISPLAY[type]?.label || type,
        timeOfDay,
        recurrence,
        assignedTo: assignedTo || null,
        createdBy: currentUserId,
      });
      setTitle("");
      onChanged();
    } catch (createError) {
      console.error("Error creating schedule:", createError);
      setError("Couldn't create that schedule. Please try again.");
    } finally {
      setPending(false);
    }
  }

  async function handleToggle(schedule: CareSchedule) {
    try {
      await updateSchedule(schedule.id, { active: !schedule.active });
      onChanged();
    } catch (toggleError) {
      console.error("Error toggling schedule:", toggleError);
      setError("Couldn't update that schedule. Please try again.");
    }
  }

  async function handleDelete(schedule: CareSchedule) {
    if (
      !window.confirm(
        `Delete the ${schedule.title} schedule? Existing event history stays.`,
      )
    ) {
      return;
    }
    try {
      await deleteSchedule(schedule.id);
      onChanged();
    } catch (deleteError) {
      console.error("Error deleting schedule:", deleteError);
      setError("Couldn't delete that schedule. Please try again.");
    }
  }

  return (
    <div className="pt-4">
      <button
        type="button"
        onClick={onBack}
        className="mb-6 flex items-center gap-1.5 text-sm font-medium text-warm-brown hover:opacity-70"
      >
        ← Back
      </button>

      <div className="mb-6">
        <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-text-muted">
          daily routine
        </p>
        <h1 className="text-4xl font-bold font-fraunces text-warm-brown">
          Your plan
        </h1>
        <p className="mt-2 text-sm text-text-muted">
          Set the routine once. Logged events mark tasks done and the whole
          household sees the same plan.
        </p>
      </div>

      <form
        onSubmit={handleCreate}
        className="mb-8 rounded-3xl border border-warm-brown/10 bg-white p-5"
      >
        <h2 className="mb-4 text-lg font-bold font-fraunces text-warm-brown">
          Add a routine item
        </h2>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="schedule-dog" className={labelClass}>
              Dog
            </label>
            <select
              id="schedule-dog"
              value={dogId}
              onChange={(event) => setDogId(event.target.value)}
              className={inputClass}
            >
              {dogs.map((dog) => (
                <option key={dog.dogId} value={dog.dogId}>
                  {dog.dogName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="schedule-type" className={labelClass}>
              Type
            </label>
            <select
              id="schedule-type"
              value={type}
              onChange={(event) => setType(event.target.value as EventType)}
              className={inputClass}
            >
              {EVENT_TYPES.map((eventType) => (
                <option key={eventType} value={eventType}>
                  {EVENT_DISPLAY[eventType]?.label ?? eventType}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-3">
          <label htmlFor="schedule-title" className={labelClass}>
            Task name
          </label>
          <input
            id="schedule-title"
            value={title}
            maxLength={80}
            placeholder="e.g. Breakfast"
            onChange={(event) => setTitle(event.target.value)}
            className={inputClass}
          />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="schedule-time" className={labelClass}>
              Time
            </label>
            <input
              id="schedule-time"
              type="time"
              value={timeOfDay}
              onChange={(event) => setTimeOfDay(event.target.value)}
              required
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="schedule-recurrence" className={labelClass}>
              Repeats
            </label>
            <select
              id="schedule-recurrence"
              value={recurrence}
              onChange={(event) =>
                setRecurrence(event.target.value as ScheduleRecurrence)
              }
              className={inputClass}
            >
              {RECURRENCES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-3">
          <label htmlFor="schedule-assignee" className={labelClass}>
            Who is responsible?
          </label>
          <select
            id="schedule-assignee"
            value={assignedTo}
            onChange={(event) => setAssignedTo(event.target.value)}
            className={inputClass}
          >
            <option value="">Anyone</option>
            {members.map((member) => (
              <option key={member.userId} value={member.userId}>
                {member.userId === currentUserId
                  ? "Me"
                  : member.displayName?.trim() || "Household member"}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <p role="alert" className="mt-3 text-sm text-rose-700">
            {error}
          </p>
        )}

        {dogs.length === 0 ? (
          <p className="mt-4 text-sm text-text-muted">
            Add a dog before creating a schedule.
          </p>
        ) : (
          <button
            type="submit"
            disabled={pending}
            className="mt-4 w-full rounded-xl bg-warm-brown py-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Adding…" : "Add schedule"}
          </button>
        )}
      </form>

      <section className="rounded-3xl border border-warm-brown/10 bg-white p-5">
        <h2 className="mb-4 text-lg font-bold font-fraunces text-warm-brown">
          Current routine
        </h2>

        {schedules.length === 0 ? (
          <p className="text-sm text-text-muted">
            Nothing in the routine yet. Add the first item above.
          </p>
        ) : (
          <ul className="divide-y divide-warm-brown/10">
            {schedules.map((schedule) => {
              const dog = dogs.find((item) => item.dogId === schedule.dogId);
              return (
                <li
                  key={schedule.id}
                  className="flex items-start justify-between gap-3 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-text-dark">
                      {schedule.timeOfDay.slice(0, 5)} · {schedule.title}
                    </p>
                    <p className="text-xs text-text-muted">
                      {dog?.dogName ?? "Unknown dog"} ·{" "}
                      {RECURRENCES.find(
                        (item) => item.value === schedule.recurrence,
                      )?.label ?? schedule.recurrence}{" "}
                      · {memberName(members, schedule.assignedTo)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void handleToggle(schedule)}
                      className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
                        schedule.active
                          ? "bg-emerald-50 text-emerald-800"
                          : "bg-light-tan text-text-muted"
                      }`}
                    >
                      {schedule.active ? "Active" : "Paused"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(schedule)}
                      className="text-xs font-medium text-rose-500 hover:text-rose-700"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
