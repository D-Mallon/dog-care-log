import { useId } from "react";
import type { EventType, HouseholdMember } from "../types/core.ts";
import type { TodayTask, TodayTaskStatus } from "../lib/schedules.ts";
import { EVENT_COLOURS } from "../lib/eventMeta.ts";

export type TodayPlanDog = {
  dogId: string;
  dogName: string;
};

export type TodayPlanProps = {
  tasks: TodayTask[];
  dogs: TodayPlanDog[];
  onToggle?: (task: TodayTask, done: boolean) => void;
  onAddSchedule?: () => void;
  isLoading?: boolean;
  members?: HouseholdMember[];
  currentUserId?: string;
};

type DogGroup = {
  dogId: string;
  dogName: string;
  tasks: TodayTask[];
};

const STATUS_META: Record<
  TodayTaskStatus,
  { label: string; className: string }
> = {
  overdue: {
    label: "Overdue",
    className: "border-rose-200 bg-rose-50 text-rose-700",
  },
  upcoming: {
    label: "Upcoming",
    className: "border-amber-200 bg-amber-50 text-amber-800",
  },
  done: {
    label: "Done",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
};

const FALLBACK_TYPE = {
  bg: "bg-light-tan",
  text: "text-warm-brown",
  emoji: "🐾",
};

/** Short, present-tense labels for planned tasks (log labels are past tense). */
const TYPE_LABELS: Record<EventType, string> = {
  feed: "Feed",
  walk: "Walk",
  toilet: "Toilet",
  meds: "Meds",
  sick: "Sick",
  nap_time: "Nap",
  play_time: "Play",
  water: "Water",
  grooming: "Grooming",
};

function formatTime(iso: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;

  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function taskTitle(task: TodayTask): string {
  const title = task.schedule.title?.trim();
  if (title) return title;
  return TYPE_LABELS[task.schedule.type] ?? task.schedule.type;
}

function groupByDog(tasks: TodayTask[], dogs: TodayPlanDog[]): DogGroup[] {
  const dogNames = new Map<string, string>();
  const dogOrder = new Map<string, number>();

  dogs.forEach((dog, index) => {
    dogNames.set(dog.dogId, dog.dogName);
    dogOrder.set(dog.dogId, index);
  });

  const groups = new Map<string, DogGroup>();

  for (const task of tasks) {
    const dogId = task.schedule.dogId;
    let group = groups.get(dogId);

    if (!group) {
      group = {
        dogId,
        dogName: dogNames.get(dogId) ?? dogId,
        tasks: [],
      };
      groups.set(dogId, group);
    }

    group.tasks.push(task);
  }

  return [...groups.values()].sort((a, b) => {
    const aOrder = dogOrder.get(a.dogId) ?? Number.MAX_SAFE_INTEGER;
    const bOrder = dogOrder.get(b.dogId) ?? Number.MAX_SAFE_INTEGER;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return a.dogName.localeCompare(b.dogName);
  });
}

export function TodayPlan({
  tasks,
  dogs,
  onToggle,
  onAddSchedule,
  isLoading = false,
  members = [],
  currentUserId = "",
}: TodayPlanProps) {
  const headingId = useId();
  const groups = groupByDog(tasks, dogs);
  const hasTasks = tasks.length > 0;

  return (
    <section
      aria-labelledby={headingId}
      aria-busy={isLoading}
      className="w-full rounded-3xl border border-warm-brown/10 bg-white p-5 shadow-sm"
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2
            id={headingId}
            className="font-fraunces text-xl font-bold text-warm-brown"
          >
            Today's plan
          </h2>
          {!isLoading && hasTasks && (
            <p className="mt-0.5 text-xs text-text-muted">
              {tasks.length} care {tasks.length === 1 ? "task" : "tasks"}{" "}
              scheduled
            </p>
          )}
        </div>

        {onAddSchedule && (
          <button
            type="button"
            onClick={onAddSchedule}
            aria-label="Edit today’s plan"
            className="shrink-0 rounded-xl bg-light-tan px-3 py-1.5 text-xs font-medium text-warm-brown transition hover:opacity-80 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-warm-brown/40"
          >
            Edit plan
          </button>
        )}
      </div>

      {isLoading ? (
        <p
          role="status"
          className="rounded-2xl bg-cream px-3 py-4 text-sm text-text-muted"
        >
          Loading today's plan...
        </p>
      ) : !hasTasks ? (
        <p className="rounded-2xl bg-cream px-3 py-4 text-sm text-text-muted">
          Nothing planned for today.
        </p>
      ) : (
        <div className="space-y-5">
          {groups.map((group) => (
            <div key={group.dogId}>
              <h3 className="mb-2 font-fraunces text-base font-semibold text-warm-brown">
                {group.dogName}
              </h3>

              <ul className="space-y-2">
                {group.tasks.map((task) => {
                  const isDone = task.status === "done";
                  const status = STATUS_META[task.status];
                  const colours =
                    EVENT_COLOURS[task.schedule.type] ?? FALLBACK_TYPE;
                  const typeLabel =
                    TYPE_LABELS[task.schedule.type] ?? task.schedule.type;
                  const title = taskTitle(task);
                  const dueTime = formatTime(task.dueAt) ?? "time not set";
                  const completedTime = task.completedAt
                    ? formatTime(task.completedAt)
                    : null;
                  const checkboxLabel = `${isDone ? "Mark not done" : "Mark done"}: ${title} for ${group.dogName}, due ${dueTime}`;

                  return (
                    <li
                      key={task.schedule.id}
                      className={`flex items-start gap-3 rounded-2xl border border-warm-brown/10 p-3 ${
                        isDone ? "bg-cream" : "bg-white"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isDone}
                        disabled={!onToggle || isLoading}
                        onChange={(event) =>
                          onToggle?.(task, event.target.checked)
                        }
                        aria-label={checkboxLabel}
                        className="mt-1 h-5 w-5 shrink-0 cursor-pointer accent-warm-brown disabled:cursor-default"
                      />

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-medium ${colours.bg} ${colours.text}`}
                          >
                            <span aria-hidden="true">{colours.emoji}</span>
                            {typeLabel}
                          </span>

                          <span
                            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${status.className}`}
                          >
                            {status.label}
                          </span>

                          <span className="text-xs text-text-muted">
                            Due{" "}
                            <time dateTime={task.dueAt}>{dueTime}</time>
                          </span>
                        </div>

                        <p
                          className={`mt-1 text-sm font-medium ${
                            isDone
                              ? "text-text-muted line-through"
                              : "text-text-dark"
                          }`}
                        >
                          {title}
                        </p>

                        {task.completedBy && (
                          <p className="mt-0.5 text-xs text-text-muted">
                            Completed by{" "}
                            {task.completedBy === currentUserId
                              ? "You"
                              : members.find(
                                  (member) =>
                                    member.userId === task.completedBy,
                                )?.displayName?.trim() ||
                                "a household member"}
                            {completedTime ? ` at ${completedTime}` : ""}
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default TodayPlan;
