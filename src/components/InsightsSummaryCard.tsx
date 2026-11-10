import { useMemo } from "react";
import type { CareEvent, Dog, WeightLog } from "../types/core.ts";
import { buildHealthBaseline } from "../lib/healthBaseline.ts";

type InsightsSummaryCardProps = {
  dogs: Dog[];
  events: CareEvent[];
  weightLogs: WeightLog[];
  onOpenInsights: () => void;
};

const severityRank = { attention: 0, watch: 1, info: 2 } as const;

export default function InsightsSummaryCard({
  dogs,
  events,
  weightLogs,
  onOpenInsights,
}: InsightsSummaryCardProps) {
  const summary = useMemo(() => {
    const reports = dogs.map((dog) => ({
      dog,
      report: buildHealthBaseline(
        dog,
        events.filter((event) => event.dogId === dog.dogId),
        weightLogs.filter((weight) => weight.dogId === dog.dogId),
      ),
    }));

    const changed = reports
      .map(({ dog, report }) => {
        const insights = report.insights.filter(
          (insight) => insight.kind !== "logging" && insight.severity !== "info",
        );
        return { dog, insights };
      })
      .filter((item) => item.insights.length > 0)
      .sort((a, b) => {
        const aTop = a.insights[0];
        const bTop = b.insights[0];
        return (
          severityRank[aTop.severity] - severityRank[bTop.severity] ||
          b.insights.length - a.insights.length
        );
      });

    const total = changed.reduce((count, item) => count + item.insights.length, 0);
    return { changed, total };
  }, [dogs, events, weightLogs]);

  if (dogs.length === 0) return null;

  if (summary.changed.length === 0) {
    return (
      <button
        type="button"
        onClick={onOpenInsights}
        className="mb-5 w-full rounded-3xl border border-warm-brown/10 bg-white p-4 text-left shadow-sm transition active:scale-[0.99]"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-light-tan text-lg">
            ✨
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
              Insights
            </p>
            <p className="font-semibold text-text-dark">
              Still learning your routine
            </p>
            <p className="mt-0.5 text-xs text-text-muted">
              A few more days of logs will make the patterns useful.
            </p>
          </div>
          <span className="text-warm-brown" aria-hidden="true">
            →
          </span>
        </div>
      </button>
    );
  }

  const lead = summary.changed[0];
  const top = lead.insights[0];

  return (
    <button
      type="button"
      onClick={onOpenInsights}
      className="mb-5 w-full rounded-3xl border border-warm-brown/10 bg-gradient-to-br from-[#fffdf9] to-[#f7eadb] p-4 text-left shadow-sm transition active:scale-[0.99]"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-warm-brown text-lg text-white">
          ✦
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
              Insights
            </p>
            <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-semibold text-warm-brown">
              {summary.total} {summary.total === 1 ? "change" : "changes"}
            </span>
          </div>
          <p className="mt-0.5 font-semibold text-text-dark">
            {lead.dog.dogName}: {top.title.toLowerCase()}
          </p>
          <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-text-muted">
            {top.detail}
          </p>
          <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-warm-brown">
            See what’s changed <span aria-hidden="true">→</span>
          </span>
        </div>
      </div>
    </button>
  );
}
