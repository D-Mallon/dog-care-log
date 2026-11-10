import { useMemo, useState } from "react";
import type { CareEvent, Dog, WeightLog } from "../types/core.ts";
import { buildHealthBaseline } from "../lib/healthBaseline.ts";
import { buildWeeklyReport } from "../lib/weeklyReport.ts";
import { recordInsightFeedback } from "../lib/insightFeedbackApi.ts";
import HealthInsights from "../components/HealthInsights.tsx";
import WeeklyReport from "../components/WeeklyReport.tsx";

type InsightsScreenProps = {
  dogs: Dog[];
  events: CareEvent[];
  weightLogs: WeightLog[];
  householdId: string;
  userId: string;
  onAddDog: () => void;
};

type InsightsTab = "changes" | "week";

export default function InsightsScreen({
  dogs,
  events,
  weightLogs,
  householdId,
  userId,
  onAddDog,
}: InsightsScreenProps) {
  const [selectedDogId, setSelectedDogId] = useState(() => {
    const byActivity = [...dogs].sort(
      (a, b) =>
        events.filter((event) => event.dogId === b.dogId).length -
        events.filter((event) => event.dogId === a.dogId).length,
    );
    return byActivity[0]?.dogId ?? "";
  });
  const [tab, setTab] = useState<InsightsTab>("changes");

  const selectedDog =
    dogs.find((dog) => dog.dogId === selectedDogId) ?? dogs[0] ?? null;

  const report = useMemo(() => {
    if (!selectedDog) return null;
    return buildHealthBaseline(
      selectedDog,
      events.filter((event) => event.dogId === selectedDog.dogId),
      weightLogs.filter((weight) => weight.dogId === selectedDog.dogId),
    );
  }, [selectedDog, events, weightLogs]);

  const weekly = useMemo(
    () => buildWeeklyReport(dogs, events, weightLogs),
    [dogs, events, weightLogs],
  );

  return (
    <div className="pt-1">
      <div className="mb-5">
        <p className="mb-1 text-xs font-semibold tracking-wide text-text-muted">
          A gentle read on the routine
        </p>
        <h1 className="text-[2.35rem] font-bold font-fraunces leading-tight text-warm-brown">
          Insights
        </h1>
        <p className="mt-1 text-sm leading-relaxed text-text-muted">
          What’s changed, what’s steady, and how the week is going. These are
          patterns from your logs — not a diagnosis.
        </p>
      </div>

      {dogs.length === 0 ? (
        <div className="rounded-3xl border border-warm-brown/10 bg-white p-5 text-center">
          <div className="mb-2 text-3xl" aria-hidden="true">
            🌱
          </div>
          <h2 className="font-fraunces text-lg font-bold text-warm-brown">
            Insights grow from care logs
          </h2>
          <p className="mx-auto mt-1 max-w-xs text-sm text-text-muted">
            Add a dog and log a few days of meals, walks and toilet breaks.
            Then this page will start to show patterns.
          </p>
          <button
            type="button"
            onClick={onAddDog}
            className="mt-4 rounded-xl bg-warm-brown px-4 py-2.5 text-sm font-semibold text-white"
          >
            Add a dog
          </button>
        </div>
      ) : (
        <>
          <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
            {dogs.map((dog) => {
              const active = dog.dogId === selectedDog?.dogId;
              return (
                <button
                  key={dog.dogId}
                  type="button"
                  onClick={() => setSelectedDogId(dog.dogId)}
                  aria-pressed={active}
                  className={`flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition ${
                    active
                      ? "border-warm-brown bg-warm-brown text-white"
                      : "border-warm-brown/15 bg-white text-text-dark"
                  }`}
                >
                  <span className="flex h-6 w-6 items-center justify-center overflow-hidden rounded-full bg-light-tan text-[11px] font-bold text-warm-brown">
                    {dog.dogImage ? (
                      <img
                        src={dog.dogImage}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      dog.dogName.charAt(0).toUpperCase()
                    )}
                  </span>
                  {dog.dogName}
                </button>
              );
            })}
          </div>

          <div
            role="tablist"
            aria-label="Insights view"
            className="mb-4 grid grid-cols-2 rounded-xl bg-light-tan/60 p-1"
          >
            {[
              { id: "changes" as const, label: "What’s changed" },
              { id: "week" as const, label: "This week" },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={tab === item.id}
                onClick={() => setTab(item.id)}
                className={`rounded-lg py-2 text-sm font-semibold transition ${
                  tab === item.id
                    ? "bg-white text-warm-brown shadow-sm"
                    : "text-text-muted"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {tab === "changes" && selectedDog && report ? (
            <HealthInsights
              report={report}
              dogName={selectedDog.dogName}
              onFeedback={(insight, response) =>
                recordInsightFeedback({
                  dogId: selectedDog.dogId,
                  householdId,
                  insightKey: insight.id,
                  insightKind: insight.kind,
                  severity: insight.severity,
                  response,
                  userId,
                })
              }
            />
          ) : (
            <WeeklyReport report={weekly} />
          )}
        </>
      )}
    </div>
  );
}
