import { useMemo, useRef, useState } from "react";
import type {
  CareSchedule,
  Dog,
  EventType,
  HouseholdMember,
  ScheduleRecurrence,
} from "../types/core.ts";
import ConfirmDialog from "../components/ConfirmDialog.tsx";
import { EVENT_DISPLAY } from "../lib/eventMeta.ts";
import {
  createScheduleGroup,
  deleteScheduleGroup,
  updateSchedule,
  updateScheduleGroup,
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

type ScheduleGroup = {
  groupId: string;
  schedules: CareSchedule[];
  title: string;
  type: EventType;
  timeOfDay: string;
  recurrence: ScheduleRecurrence;
  active: boolean;
  assignedTo?: string;
  dogIds: string[];
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

function buildGroups(schedules: CareSchedule[]): ScheduleGroup[] {
  const byGroup = new Map<string, CareSchedule[]>();

  for (const schedule of schedules) {
    const groupId = schedule.groupId || schedule.id;
    const current = byGroup.get(groupId);
    if (current) current.push(schedule);
    else byGroup.set(groupId, [schedule]);
  }

  return [...byGroup.entries()]
    .map(([groupId, rows]) => {
      const first = rows[0];
      return {
        groupId,
        schedules: rows,
        title: first.title,
        type: first.type,
        timeOfDay: first.timeOfDay,
        recurrence: first.recurrence,
        active: rows.every((row) => row.active),
        assignedTo: first.assignedTo,
        dogIds: rows.map((row) => row.dogId),
      };
    })
    .sort(
      (a, b) =>
        a.timeOfDay.localeCompare(b.timeOfDay) ||
        a.title.localeCompare(b.title),
    );
}

function dogLabel(dogs: Dog[], dogIds: string[]): string {
  const names = dogIds.map(
    (dogId) => dogs.find((dog) => dog.dogId === dogId)?.dogName ?? "Unknown dog",
  );
  if (names.length === 0) return "No dogs selected";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
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
  const formRef = useRef<HTMLFormElement>(null);
  const [dogIds, setDogIds] = useState<string[]>(() =>
    dogs[0] ? [dogs[0].dogId] : [],
  );
  const [type, setType] = useState<EventType>("feed");
  const [title, setTitle] = useState("");
  const [timeOfDay, setTimeOfDay] = useState("08:00");
  const [recurrence, setRecurrence] =
    useState<ScheduleRecurrence>("daily");
  const [assignedTo, setAssignedTo] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [scheduleToDelete, setScheduleToDelete] =
    useState<ScheduleGroup | null>(null);
  const [deletingGroup, setDeletingGroup] = useState(false);

  const groups = useMemo(() => buildGroups(schedules), [schedules]);

  function toggleDog(dogId: string) {
    setDogIds((previous) =>
      previous.includes(dogId)
        ? previous.filter((id) => id !== dogId)
        : [...previous, dogId],
    );
  }

  function resetForm() {
    setEditingGroupId(null);
    setDogIds(dogs[0] ? [dogs[0].dogId] : []);
    setType("feed");
    setTitle("");
    setTimeOfDay("08:00");
    setRecurrence("daily");
    setAssignedTo("");
    setError(null);
  }

  function startEdit(group: ScheduleGroup) {
    setEditingGroupId(group.groupId);
    setDogIds(group.dogIds);
    setType(group.type);
    setTitle(group.title);
    setTimeOfDay(group.timeOfDay.slice(0, 5));
    setRecurrence(group.recurrence);
    setAssignedTo(group.assignedTo ?? "");
    setError(null);
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const selectedDogIds = dogIds.filter((dogId) =>
      dogs.some((dog) => dog.dogId === dogId),
    );
    if (selectedDogIds.length === 0) {
      setError("Choose at least one dog.");
      return;
    }

    setPending(true);
    setError(null);
    const resolvedTitle =
      title.trim() || EVENT_DISPLAY[type]?.label || type;

    try {
      if (editingGroupId) {
        await updateScheduleGroup(
          editingGroupId,
          {
            type,
            title: resolvedTitle,
            timeOfDay,
            recurrence,
            assignedTo: assignedTo || null,
          },
          selectedDogIds,
        );
      } else {
        await createScheduleGroup({
          householdId,
          dogIds: selectedDogIds,
          type,
          title: resolvedTitle,
          timeOfDay,
          recurrence,
          assignedTo: assignedTo || null,
          createdBy: currentUserId,
        });
      }
      resetForm();
      onChanged();
    } catch (submitError) {
      console.error("Error saving schedule:", submitError);
      setError(
        editingGroupId
          ? "Couldn't save those changes. Please try again."
          : "Couldn't create that schedule. Please try again.",
      );
    } finally {
      setPending(false);
    }
  }

  async function handleToggleActive(group: ScheduleGroup) {
    const nextActive = !group.active;
    try {
      await Promise.all(
        group.schedules.map((schedule) =>
          updateSchedule(schedule.id, { active: nextActive }),
        ),
      );
      onChanged();
    } catch (toggleError) {
      console.error("Error toggling schedule:", toggleError);
      setError("Couldn't update that schedule. Please try again.");
    }
  }

  async function handleDelete(group: ScheduleGroup) {
    setDeletingGroup(true);
    try {
      await deleteScheduleGroup(group.groupId);
      onChanged();
    } catch (deleteError) {
      console.error("Error deleting schedule:", deleteError);
      setError("Couldn't delete that schedule. Please try again.");
    } finally {
      setDeletingGroup(false);
      setScheduleToDelete(null);
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
          Set the routine once. One walk can cover several dogs, and the whole
          household sees the same plan.
        </p>
      </div>

      <form
        ref={formRef}
        onSubmit={handleSubmit}
        className="mb-8 scroll-mt-20 rounded-3xl border border-warm-brown/10 bg-white p-5"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="text-lg font-bold font-fraunces text-warm-brown">
            {editingGroupId ? "Edit routine" : "Add a routine item"}
          </h2>
          {editingGroupId && (
            <button
              type="button"
              onClick={resetForm}
              className="text-xs font-medium text-text-muted underline underline-offset-2 hover:text-warm-brown"
            >
              Cancel edit
            </button>
          )}
        </div>

        <fieldset>
          <legend className={labelClass}>Dogs</legend>
          {dogs.length === 0 ? (
            <p className="text-sm text-text-muted">
              Add a dog before creating a schedule.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {dogs.map((dog) => {
                const selected = dogIds.includes(dog.dogId);
                return (
                  <button
                    key={dog.dogId}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggleDog(dog.dogId)}
                    className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${
                      selected
                        ? "border-warm-brown bg-warm-brown text-white"
                        : "border-warm-brown/20 bg-cream text-text-dark hover:bg-light-tan"
                    }`}
                  >
                    {selected ? "✓ " : ""}
                    {dog.dogName}
                  </button>
                );
              })}
            </div>
          )}
        </fieldset>

        <div className="mt-3 grid grid-cols-2 gap-3">
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
          <div>
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
        </div>

        {error && (
          <p role="alert" className="mt-3 text-sm text-rose-700">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending || dogs.length === 0}
          className="mt-4 w-full rounded-xl bg-warm-brown py-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          {pending
            ? "Saving…"
            : editingGroupId
              ? "Save changes"
              : "Add schedule"}
        </button>
      </form>

      <section className="rounded-3xl border border-warm-brown/10 bg-white p-5">
        <h2 className="mb-4 text-lg font-bold font-fraunces text-warm-brown">
          Current routine
        </h2>

        {groups.length === 0 ? (
          <p className="text-sm text-text-muted">
            Nothing in the routine yet. Add the first item above.
          </p>
        ) : (
          <ul className="divide-y divide-warm-brown/10">
            {groups.map((group) => (
              <li
                key={group.groupId}
                className="py-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-text-dark">
                      {group.timeOfDay.slice(0, 5)} · {group.title}
                    </p>
                    <p className="text-xs text-text-muted">
                      {dogLabel(dogs, group.dogIds)} ·{" "}
                      {RECURRENCES.find(
                        (item) => item.value === group.recurrence,
                      )?.label ?? group.recurrence}{" "}
                      · {memberName(members, group.assignedTo)}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(group)}
                      className="rounded-lg border border-warm-brown/20 px-2.5 py-1.5 text-xs font-semibold text-warm-brown hover:bg-light-tan"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleToggleActive(group)}
                      className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
                        group.active
                          ? "bg-emerald-50 text-emerald-800"
                          : "bg-light-tan text-text-muted"
                      }`}
                    >
                      {group.active ? "Active" : "Paused"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setScheduleToDelete(group)}
                      className="text-xs font-medium text-rose-500 hover:text-rose-700"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {scheduleToDelete && (
        <ConfirmDialog
          title={`Delete the ${scheduleToDelete.title} routine?`}
          description="Existing logged events stay in the household history."
          confirmLabel="Delete routine"
          tone="danger"
          pending={deletingGroup}
          onConfirm={() => void handleDelete(scheduleToDelete)}
          onCancel={() => setScheduleToDelete(null)}
        >
          <p className="text-sm text-text-muted">
            This stops the task appearing in today’s plan for{" "}
            {dogLabel(dogs, scheduleToDelete.dogIds)}. You can add it again
            later.
          </p>
        </ConfirmDialog>
      )}
    </div>
  );
}
