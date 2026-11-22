import { useId } from "react";
import type { EventType, HouseholdMember } from "../types/core.ts";
import {
  groupTodayTasks,
  type TodayTask,
  type TodayTaskGroup,
  type TodayTaskStatus,
} from "../lib/schedules.ts";
import { EVENT_COLOURS } from "../lib/eventMeta.ts";

export type TodayPlanDog = {
  dogId: string;
  dogName: string;
};

export type TodayPlanProps = {
  tasks: TodayTask[];
  dogs: TodayPlanDog[];
  onToggle?: (tasks: TodayTask[], done: boolean) => void;
  onAddSchedule?: () => void;
  isLoading?: boolean;
  members?: HouseholdMember[];
  currentUserId?: string;
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

function taskTitle(group: TodayTaskGroup): string {
  const title = group.title?.trim();
  if (title) return title;
  return TYPE_LABELS[group.type] ?? group.type;
}

function joinNames(names: string[]): string {
  if (names.length === 0) return "your dogs";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
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
  const groups = groupTodayTasks(tasks);
  const dogNames = new Map(dogs.map((dog) => [dog.dogId, dog.dogName]));

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
          {!isLoading && groups.length > 0 && (
            <p className="mt-0.5 text-xs text-text-muted">
              {groups.length} care {groups.length === 1 ? "task" : "tasks"}{" "}
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
      ) : groups.length === 0 ? (
        <p className="rounded-2xl bg-cream px-3 py-4 text-sm text-text-muted">
          Nothing planned for today.
        </p>
      ) : (
        <ul className="space-y-2">
          {groups.map((group) => {
            const isDone = group.status === "done";
            const status = STATUS_META[group.status];
            const colours = EVENT_COLOURS[group.type] ?? FALLBACK_TYPE;
            const typeLabel = TYPE_LABELS[group.type] ?? group.type;
            const title = taskTitle(group);
            const dueTime = formatTime(group.dueAt) ?? "time not set";
            const completedTime = group.completedAt
              ? formatTime(group.completedAt)
              : null;
            const names = group.dogIds
              .map((dogId) => dogNames.get(dogId) ?? dogId)
              .filter(Boolean);
            const heading = joinNames(names);
            const checkboxLabel = `${isDone ? "Mark not done" : "Mark done"}: ${title} for ${heading}, due ${dueTime}`;

            return (
              <li
                key={group.groupId}
                className={`flex items-start gap-3 rounded-2xl border border-warm-brown/10 p-3 ${
                  isDone ? "bg-cream" : "bg-white"
                }`}
              >
                <input
                  type="checkbox"
                  checked={isDone}
                  disabled={!onToggle || isLoading}
                  onChange={(event) =>
                    onToggle?.(group.tasks, event.target.checked)
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
                      Due <time dateTime={group.dueAt}>{dueTime}</time>
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
                  <p className="mt-0.5 text-xs text-text-muted">
                    For {heading}
                  </p>

                  {group.completedBy && (
                    <p className="mt-0.5 text-xs text-text-muted">
                      Completed by{" "}
                      {group.completedBy === currentUserId
                        ? "You"
                        : members.find(
                            (member) => member.userId === group.completedBy,
                          )?.displayName?.trim() || "a household member"}
                      {completedTime ? ` at ${completedTime}` : ""}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default TodayPlan;
