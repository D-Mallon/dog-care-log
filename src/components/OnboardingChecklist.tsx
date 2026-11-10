import { useMemo, useState } from "react";
import type {
  CareEvent,
  CareSchedule,
  Dog,
  HouseholdMember,
  WeightLog,
} from "../types/core.ts";
import { buildHealthBaseline } from "../lib/healthBaseline.ts";

type OnboardingStep = {
  id: string;
  label: string;
  detail: string;
  done: boolean;
  action: "addDog" | "logEvent" | "schedules" | "household" | "insights";
  actionLabel: string;
};

type OnboardingChecklistProps = {
  dogs: Dog[];
  events: CareEvent[];
  schedules: CareSchedule[];
  members: HouseholdMember[];
  weightLogs: WeightLog[];
  onNavigate: (screen: OnboardingStep["action"]) => void;
};

const DISMISS_KEY = "loggi:onboarding-dismissed";

export default function OnboardingChecklist({
  dogs,
  events,
  schedules,
  members,
  weightLogs,
  onNavigate,
}: OnboardingChecklistProps) {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return window.localStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      return false;
    }
  });

  const steps = useMemo<OnboardingStep[]>(() => {
    const hasInsight = dogs.some((dog) => {
      const report = buildHealthBaseline(
        dog,
        events.filter((event) => event.dogId === dog.dogId),
        weightLogs.filter((weight) => weight.dogId === dog.dogId),
      );
      return report.dataQuality !== "insufficient";
    });

    return [
      {
        id: "dog",
        label: "Add your first dog",
        detail: "Their name, breed and a photo are enough to begin.",
        done: dogs.length > 0,
        action: "addDog",
        actionLabel: "Add a dog",
      },
      {
        id: "event",
        label: "Log one care moment",
        detail: "A feed, a walk or a toilet break. One tap is enough.",
        done: events.length > 0,
        action: "logEvent",
        actionLabel: "Log care",
      },
      {
        id: "routine",
        label: "Set a simple routine",
        detail: "Add the meals and walks you want the household to share.",
        done: schedules.length > 0,
        action: "schedules",
        actionLabel: "Set routine",
      },
      {
        id: "invite",
        label: "Invite someone who helps",
        detail: "A partner, family member or sitter can share the load.",
        done: members.filter((member) => member.status === "active").length > 1,
        action: "household",
        actionLabel: "Invite",
      },
      {
        id: "insight",
        label: "See your first insight",
        detail: "A few days of logs turn into useful pattern observations.",
        done: hasInsight,
        action: "insights",
        actionLabel: "View insights",
      },
    ];
  }, [dogs, events, schedules, members, weightLogs]);

  const completed = steps.filter((step) => step.done).length;

  if (dismissed || completed === steps.length) return null;

  return (
    <section className="mb-5 rounded-3xl border border-warm-brown/10 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
            Getting started
          </p>
          <h2 className="mt-0.5 font-fraunces text-lg font-bold text-warm-brown">
            A good first week
          </h2>
          <p className="mt-0.5 text-xs text-text-muted">
            {completed} of {steps.length} done — no rush.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setDismissed(true);
            try {
              window.localStorage.setItem(DISMISS_KEY, "1");
            } catch {
              // Private mode or storage blocked; dismiss for this session only.
            }
          }}
          className="rounded-lg px-2 py-1 text-xs text-text-muted hover:text-warm-brown"
        >
          Hide
        </button>
      </div>

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-light-tan">
        <div
          className="h-full rounded-full bg-warm-brown transition-all"
          style={{ width: `${(completed / steps.length) * 100}%` }}
        />
      </div>

      {completed > 0 && (
        <p className="mt-3 rounded-xl bg-[#f4f7f0] px-3 py-2 text-xs leading-relaxed text-[#52684b]">
          Done:{" "}
          {steps
            .filter((step) => step.done)
            .map((step) => step.label.toLowerCase())
            .join(" · ")}
        </p>
      )}

      <ul className="mt-2 space-y-2">
        {steps
          .filter((step) => !step.done)
          .map((step) => (
            <li
              key={step.id}
              className="flex items-start gap-3 rounded-2xl bg-cream/70 p-2.5"
            >
              <span
                aria-hidden="true"
                className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-warm-brown/20 text-text-muted"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-text-dark">
                  {step.label}
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-text-muted">
                  {step.detail}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate(step.action)}
                className="shrink-0 rounded-lg bg-white px-2.5 py-1.5 text-[11px] font-semibold text-warm-brown shadow-sm"
              >
                {step.actionLabel}
              </button>
            </li>
          ))}
      </ul>
    </section>
  );
}
