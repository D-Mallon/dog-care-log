import type { PottyConfidence, PottySummary } from "../lib/pottyTraining.ts";

type PottyDashboardProps = {
  summary: PottySummary;
  dogName: string;
  onLogSuccess?: () => void;
  onLogAccident?: () => void;
};

const CONFIDENCE_STYLES: Record<
  PottyConfidence,
  { label: string; className: string; description: string }
> = {
  low: {
    label: "Low confidence",
    className: "border-light-tan bg-cream text-text-muted",
    description: "Based on very little recent data.",
  },
  medium: {
    label: "Medium confidence",
    className: "border-light-tan bg-light-tan text-warm-brown",
    description: "Based on a few recent toilet breaks.",
  },
  high: {
    label: "High confidence",
    className: "border-emerald-200 bg-emerald-50 text-emerald-800",
    description: "Based on a steady recent routine.",
  },
};

function formatClock(date: Date): string {
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatWindowLabel(
  startIso: string,
  endIso: string,
  now: Date,
): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return "Not enough data";
  }

  const dayLabel =
    start.toDateString() === now.toDateString()
      ? "Today"
      : start.toLocaleDateString([], {
          weekday: "short",
          month: "short",
          day: "numeric",
        });

  return `${dayLabel}, ${formatClock(start)}–${formatClock(end)}`;
}

function windowStatus(
  startIso: string,
  endIso: string,
  nowMs: number,
): { label: string; className: string } {
  const startMs = new Date(startIso).getTime();
  const endMs = new Date(endIso).getTime();

  if (endMs < nowMs) {
    return {
      label: "Overdue",
      className: "border-rose-200 bg-rose-50 text-rose-800",
    };
  }
  if (startMs - nowMs <= 60 * 60 * 1000) {
    return {
      label: "Due soon",
      className: "border-amber-200 bg-amber-50 text-amber-900",
    };
  }
  return {
    label: "Upcoming",
    className: "border-emerald-200 bg-emerald-50 text-emerald-800",
  };
}

export default function PottyDashboard({
  summary,
  dogName,
  onLogSuccess,
  onLogAccident,
}: PottyDashboardProps) {
  const now = new Date();
  const confidence = CONFIDENCE_STYLES[summary.confidence];
  const windowStart = summary.nextWindowStart;
  const windowEnd = summary.nextWindowEnd;
  const windowLabel =
    windowStart !== null && windowEnd !== null
      ? formatWindowLabel(windowStart, windowEnd, now)
      : null;
  const status =
    windowStart !== null && windowEnd !== null
      ? windowStatus(windowStart, windowEnd, now.getTime())
      : null;
  const successRateLabel =
    summary.successRate7d === null
      ? "—"
      : `${Math.round(summary.successRate7d * 100)}%`;
  const tips = summary.tips.slice(0, 3);

  return (
    <section
      aria-label={`Potty training progress for ${dogName}`}
      className="w-full rounded-3xl border border-light-tan bg-white p-5 shadow-sm"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
            Potty training
          </p>
          <h2 className="font-fraunces text-xl font-bold leading-tight text-warm-brown">
            {`${dogName}'s progress`}
          </h2>
        </div>
        <span
          className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${confidence.className}`}
          title={confidence.description}
        >
          {confidence.label}
          <span className="sr-only"> ({confidence.description})</span>
        </span>
      </div>

      <div className="mt-4 rounded-2xl bg-cream p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-warm-brown">
            Next potty window
          </h3>
          {status && (
            <span
              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${status.className}`}
            >
              {status.label}
            </span>
          )}
        </div>

        {windowLabel ? (
          <>
            <p className="mt-1 font-fraunces text-2xl font-bold text-warm-brown">
              {windowLabel}
            </p>
            <p className="mt-1 text-xs text-text-muted">
              Estimated from recent toilet breaks — a guide, not a schedule.
            </p>
          </>
        ) : (
          <p className="mt-2 text-sm text-text-muted">
            Not enough data yet. Log a toilet break to start estimating the
            next window.
          </p>
        )}
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-2">
        <div className="rounded-2xl border border-light-tan bg-cream px-3 py-3">
          <dt className="text-[11px] font-medium uppercase tracking-wide text-text-muted">
            Successes today
          </dt>
          <dd className="mt-1 font-fraunces text-2xl font-bold text-warm-brown">
            {summary.todaySuccess}
          </dd>
        </div>
        <div className="rounded-2xl border border-light-tan bg-cream px-3 py-3">
          <dt className="text-[11px] font-medium uppercase tracking-wide text-text-muted">
            Accidents today
          </dt>
          <dd className="mt-1 font-fraunces text-2xl font-bold text-warm-brown">
            {summary.todayAccidents}
          </dd>
        </div>
        <div className="rounded-2xl border border-light-tan bg-cream px-3 py-3">
          <dt className="text-[11px] font-medium uppercase tracking-wide text-text-muted">
            7-day success
          </dt>
          <dd className="mt-1 font-fraunces text-2xl font-bold text-warm-brown">
            {successRateLabel}
            {summary.successRate7d === null && (
              <span className="sr-only"> (not enough data)</span>
            )}
          </dd>
        </div>
      </dl>

      {summary.accidentPattern && (
        <div className="mt-4 rounded-2xl border border-light-tan bg-light-tan p-3">
          <h3 className="text-sm font-semibold text-warm-brown">
            Accident pattern
          </h3>
          <p className="mt-1 text-sm text-text-dark">
            {summary.accidentPattern}
          </p>
        </div>
      )}

      <div className="mt-4">
        <h3 className="text-sm font-semibold text-warm-brown">Tips</h3>
        {tips.length > 0 ? (
          <ul className="mt-1 list-disc space-y-1.5 pl-5">
            {tips.map((tip, index) => (
              <li
                key={`${index}-${tip}`}
                className={
                  index === tips.length - 1
                    ? "text-xs text-text-muted"
                    : "text-sm text-text-dark"
                }
              >
                {tip}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-sm text-text-muted">
            No tips yet — log a few toilet breaks to get guidance.
          </p>
        )}
      </div>

      {(onLogSuccess || onLogAccident) && (
        <div className="mt-4 flex flex-wrap gap-2">
          {onLogSuccess && (
            <button
              type="button"
              onClick={onLogSuccess}
              aria-label={`Log a potty success for ${dogName}`}
              className="flex-1 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm font-medium text-emerald-900 transition-all hover:bg-emerald-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 active:scale-95"
            >
              Log success
            </button>
          )}
          {onLogAccident && (
            <button
              type="button"
              onClick={onLogAccident}
              aria-label={`Log a potty accident for ${dogName}`}
              className="flex-1 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm font-medium text-rose-900 transition-all hover:bg-rose-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 active:scale-95"
            >
              Log accident
            </button>
          )}
        </div>
      )}

      <p className="mt-3 text-[11px] text-text-muted">
        Estimates use the last 7 days of logs and are general training
        guidance.
      </p>
    </section>
  );
}
