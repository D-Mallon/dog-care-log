import { useId } from "react";
import type { DogWeekSummary, WeeklyReport } from "../lib/weeklyReport.ts";

type WeeklyReportProps = {
  report: WeeklyReport;
  onShare?: () => void;
  onExport?: () => void;
};

type SummaryCardProps = {
  label: string;
  value: string;
  detail: string;
};

function formatDateRange(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return "";
  }

  const startLabel = start.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
  const endLabel = end.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return `${startLabel} – ${endLabel}`;
}

function formatPottyRate(rate: number | null): string {
  return rate === null ? "—" : `${Math.round(rate * 100)}%`;
}

function formatWeight(weight: number): string {
  return `${weight.toFixed(1)} kg`;
}

function formatWeightChange(change: number): string {
  if (change === 0) return "No change";
  const sign = change > 0 ? "+" : "−";
  return `${sign}${Math.abs(change).toFixed(1)} kg`;
}

function SummaryCard({ label, value, detail }: SummaryCardProps) {
  return (
    <div className="rounded-2xl bg-cream p-3">
      <dt className="text-xs font-medium text-text-muted">{label}</dt>
      <dd>
        <span className="mt-1 block font-fraunces text-2xl font-bold leading-none text-warm-brown">
          {value}
        </span>
        <span className="mt-1 block text-[11px] leading-snug text-text-muted">
          {detail}
        </span>
      </dd>
    </div>
  );
}

function weightCardContent(report: WeeklyReport): {
  value: string;
  detail: string;
} {
  const dogsWithWeight = report.dogs.filter((dog) => dog.weight !== null);

  if (dogsWithWeight.length === 0) {
    return { value: "—", detail: "No weight change in this window" };
  }

  if (dogsWithWeight.length === 1) {
    const trend = dogsWithWeight[0].weight;
    if (!trend) {
      return { value: "—", detail: "No weight change in this window" };
    }
    return {
      value: formatWeightChange(trend.change),
      detail: `${formatWeight(trend.startWeight)} → ${formatWeight(trend.endWeight)}`,
    };
  }

  return {
    value: `${dogsWithWeight.length} dogs`,
    detail: "See changes by dog below",
  };
}

function DogRow({ dog }: { dog: DogWeekSummary }) {
  const classified = dog.pottySuccessCount + dog.pottyAccidentCount;

  return (
    <li className="rounded-2xl border border-warm-brown/10 bg-cream p-4">
      <div className="flex items-center gap-3">
        {dog.dogImage ? (
          <img
            src={dog.dogImage}
            alt=""
            className="h-10 w-10 rounded-xl border border-warm-brown/10 object-cover"
          />
        ) : (
          <span
            aria-hidden="true"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-warm-brown/10 bg-white text-lg"
          >
            🐾
          </span>
        )}
        <div className="min-w-0">
          <h3 className="truncate font-fraunces text-base font-bold text-warm-brown">
            {dog.dogName}
          </h3>
          <p className="text-xs text-text-muted">
            {dog.activeDayCount} of {dog.consistency.daysInWindow} active days ·{" "}
            {dog.eventCount} events
          </p>
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-white/80 px-2 py-2">
          <dt className="text-[11px] text-text-muted">Feeds</dt>
          <dd className="text-sm font-semibold text-warm-brown">
            {dog.feedCount}
          </dd>
        </div>
        <div className="rounded-xl bg-white/80 px-2 py-2">
          <dt className="text-[11px] text-text-muted">Walks</dt>
          <dd className="text-sm font-semibold text-warm-brown">
            {dog.walkCount}
          </dd>
        </div>
        <div className="rounded-xl bg-white/80 px-2 py-2">
          <dt className="text-[11px] text-text-muted">Toilet</dt>
          <dd className="text-sm font-semibold text-warm-brown">
            {dog.toiletCount}
          </dd>
        </div>
      </dl>

      <div className="mt-3 space-y-1 text-xs leading-relaxed text-text-muted">
        <p>
          <span className="font-medium text-text-dark">Potty success:</span>{" "}
          {dog.pottySuccessRate === null
            ? "no classified outcomes yet"
            : `${formatPottyRate(dog.pottySuccessRate)} (${dog.pottySuccessCount} of ${classified})`}
        </p>
        <p>
          <span className="font-medium text-text-dark">Weight:</span>{" "}
          {dog.weight
            ? `${formatWeight(dog.weight.startWeight)} → ${formatWeight(
                dog.weight.endWeight,
              )} (${formatWeightChange(dog.weight.change)})`
            : dog.weightLogCount === 1
              ? "one weigh-in, so no change is shown"
              : "no weigh-ins in this window"}
        </p>
        <p>
          <span className="font-medium text-text-dark">Consistency:</span> feed
          or walk logged on {dog.consistency.careDays} of{" "}
          {dog.consistency.daysInWindow} days
          {dog.consistency.longestCareStreak > 1
            ? ` · longest run ${dog.consistency.longestCareStreak} days`
            : ""}
        </p>
      </div>

      {dog.eventCount === 0 && (
        <p className="mt-2 text-xs text-text-muted">
          No care events were logged for this dog in this window.
        </p>
      )}
    </li>
  );
}

type ObservationListProps = {
  title: string;
  items: string[];
  tone: "highlight" | "concern";
};

function ObservationList({ title, items, tone }: ObservationListProps) {
  if (items.length === 0) return null;

  return (
    <section className="mt-5">
      <h3 className="font-fraunces text-base font-bold text-warm-brown">
        {title}
      </h3>
      <ul
        className={`mt-2 list-disc space-y-1 rounded-2xl px-4 py-3 pl-8 text-xs leading-relaxed ${
          tone === "highlight"
            ? "bg-green-50 text-green-900"
            : "bg-amber-50 text-amber-900"
        }`}
      >
        {items.map((item, index) => (
          <li key={index}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

export default function WeeklyReport({
  report,
  onShare,
  onExport,
}: WeeklyReportProps) {
  const titleId = useId();
  const windowLabel = formatDateRange(
    report.window.start,
    report.window.end,
  );
  const weightCard = weightCardContent(report);
  const classified =
    report.household.pottySuccessCount + report.household.pottyAccidentCount;

  return (
    <section
      aria-labelledby={titleId}
      className="w-full rounded-3xl border border-warm-brown/10 bg-white p-5 shadow-sm"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-text-muted">
            Weekly progress
          </p>
          <h2
            id={titleId}
            className="font-fraunces text-xl font-bold text-warm-brown"
          >
            This week at a glance
          </h2>
          {windowLabel && (
            <p className="mt-1 text-xs text-text-muted">{windowLabel}</p>
          )}
        </div>

        {(onShare || onExport) && (
          <div className="flex flex-wrap gap-2">
            {onShare && (
              <button
                type="button"
                onClick={onShare}
                aria-label="Share weekly report"
                className="rounded-xl bg-warm-brown px-3 py-2 text-xs font-semibold text-white hover:opacity-90"
              >
                Share
              </button>
            )}
            {onExport && (
              <button
                type="button"
                onClick={onExport}
                aria-label="Export weekly report"
                className="rounded-xl border border-warm-brown/20 px-3 py-2 text-xs font-semibold text-warm-brown hover:bg-light-tan"
              >
                Export
              </button>
            )}
          </div>
        )}
      </div>

      <p className="mt-4 rounded-2xl bg-light-tan px-3 py-2 text-xs leading-relaxed text-text-dark">
        {report.disclaimer}
      </p>

      {report.household.dogCount === 0 ? (
        <p className="mt-4 rounded-2xl bg-cream px-4 py-6 text-center text-sm text-text-muted">
          No dogs are set up in this household yet. Add a dog to start building
          a weekly progress report.
        </p>
      ) : (
        <>
          {report.household.eventCount === 0 && (
            <p className="mt-4 rounded-2xl bg-cream px-4 py-4 text-center text-sm text-text-muted">
              No care events were logged in this window yet. The report will
              fill in as events are recorded.
            </p>
          )}

          <dl className="mt-4 grid grid-cols-2 gap-2">
            <SummaryCard
              label="Events logged"
              value={String(report.household.eventCount)}
              detail={`${report.household.activeDayCount} active ${
                report.household.activeDayCount === 1 ? "day" : "days"
              }`}
            />
            <SummaryCard
              label="Potty success"
              value={formatPottyRate(report.household.pottySuccessRate)}
              detail={
                report.household.pottySuccessRate === null
                  ? "No classified outcomes yet"
                  : `${report.household.pottySuccessCount} of ${classified} marked as success`
              }
            />
            <SummaryCard
              label="Active days"
              value={`${report.household.activeDayCount}/${report.household.consistency.daysInWindow}`}
              detail={
                report.household.activeDayCount === 0
                  ? "No active days in this window"
                  : `${report.household.averageEventsPerActiveDay} events per active day`
              }
            />
            <SummaryCard
              label="Weight change"
              value={weightCard.value}
              detail={weightCard.detail}
            />
          </dl>

          <section className="mt-5">
            <h3 className="font-fraunces text-base font-bold text-warm-brown">
              By dog
            </h3>
            <ul className="mt-2 space-y-3">
              {report.dogs.map((dog) => (
                <DogRow key={dog.dogId} dog={dog} />
              ))}
            </ul>
          </section>
        </>
      )}

      <ObservationList
        title="Highlights"
        items={report.highlights}
        tone="highlight"
      />
      <ObservationList
        title="Worth noting"
        items={report.concerns}
        tone="concern"
      />
    </section>
  );
}
