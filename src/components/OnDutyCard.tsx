import type { HouseholdMember } from "../types/core.ts";
import type { TodayTask } from "../lib/schedules.ts";

type OnDutyCardProps = {
  tasks: TodayTask[];
  members: HouseholdMember[];
  currentUserId: string;
  onTakeTask: (task: TodayTask) => void;
  onOpenPlan: () => void;
};

function memberName(
  members: HouseholdMember[],
  userId: string | undefined,
): string | null {
  if (!userId) return null;
  if (userId === "me") return "You";
  const member = members.find((item) => item.userId === userId);
  return member?.displayName?.trim() || "Household member";
}

export default function OnDutyCard({
  tasks,
  members,
  currentUserId,
  onTakeTask,
  onOpenPlan,
}: OnDutyCardProps) {
  const open = tasks
    .filter((task) => task.status !== "done")
    .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
  const next = open[0];

  if (!next) {
    const hasTasks = tasks.length > 0;
    return (
      <div className="mb-5 rounded-3xl border border-warm-brown/10 bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
              Who’s on duty
            </p>
            <p className="mt-0.5 font-semibold text-text-dark">
              {hasTasks ? "All care is done for today" : "No routine set yet"}
            </p>
            <p className="mt-0.5 text-xs text-text-muted">
              {hasTasks
                ? "Nice work. You can add another task if something comes up."
                : "Set a simple routine so everyone knows what’s next."}
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenPlan}
            className="shrink-0 rounded-xl bg-light-tan px-3 py-2 text-xs font-semibold text-warm-brown"
          >
            {hasTasks ? "See plan" : "Set routine"}
          </button>
        </div>
      </div>
    );
  }

  const assigned = memberName(members, next.schedule.assignedTo);
  const isMine = next.schedule.assignedTo === currentUserId;
  const due = new Date(next.dueAt).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
  const overdue = next.status === "overdue";

  return (
    <div className="mb-5 rounded-3xl border border-warm-brown/10 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
            Who’s on duty
          </p>
          <p className="mt-0.5 font-semibold text-text-dark">
            {isMine ? "You’re up next" : assigned ? `${assigned} is up next` : "Next up for anyone"}
          </p>
          <p className="mt-0.5 text-sm text-text-muted">
            {next.schedule.title} · {due}
            {overdue && (
              <span className="ml-2 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
                Overdue
              </span>
            )}
          </p>
        </div>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-light-tan text-lg">
          {isMine ? "🐾" : "👋"}
        </span>
      </div>

      <div className="mt-3 flex gap-2">
        {!isMine && (
          <button
            type="button"
            onClick={() => onTakeTask(next)}
            className="flex-1 rounded-xl bg-warm-brown py-2.5 text-sm font-semibold text-white hover:opacity-90"
          >
            I’ll take it
          </button>
        )}
        <button
          type="button"
          onClick={onOpenPlan}
          className="flex-1 rounded-xl border border-warm-brown/20 py-2.5 text-sm font-semibold text-warm-brown hover:bg-light-tan"
        >
          Open plan
        </button>
      </div>
    </div>
  );
}
