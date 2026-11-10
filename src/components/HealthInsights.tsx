import { useId, useState } from "react";
import type {
  HealthBaselineReport,
  HealthInsight,
} from "../lib/healthBaseline.ts";
import type { InsightFeedbackResponse } from "../lib/insightFeedbackApi.ts";

type HealthInsightsProps = {
  report: HealthBaselineReport;
  dogName: string;
  onFeedback?: (
    insight: HealthInsight,
    response: InsightFeedbackResponse,
  ) => Promise<void> | void;
};

const SEVERITY_STYLES: Record<
  HealthInsight["severity"],
  { card: string; badge: string; label: string }
> = {
  attention: {
    card: "border-rose-200 bg-rose-50/70",
    badge: "bg-rose-100 text-rose-800",
    label: "Worth a look",
  },
  watch: {
    card: "border-amber-200 bg-amber-50/70",
    badge: "bg-amber-100 text-amber-800",
    label: "Worth noting",
  },
  info: {
    card: "border-warm-brown/10 bg-cream",
    badge: "bg-light-tan text-warm-brown",
    label: "Steady",
  },
};

function confidenceLabel(value: HealthInsight["confidence"]): string {
  return `${value} confidence`;
}

export default function HealthInsights({
  report,
  dogName,
  onFeedback,
}: HealthInsightsProps) {
  const headingId = useId();
  const [submitted, setSubmitted] = useState<
    Record<string, InsightFeedbackResponse>
  >({});
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFeedback(
    insight: HealthInsight,
    response: InsightFeedbackResponse,
  ) {
    if (!onFeedback || pendingId) return;
    setPendingId(insight.id);
    setError(null);
    try {
      await onFeedback(insight, response);
      setSubmitted((previous) => ({ ...previous, [insight.id]: response }));
    } catch (feedbackError) {
      console.error("Error saving insight feedback:", feedbackError);
      setError("Couldn't save that feedback. Please try again.");
    } finally {
      setPendingId(null);
    }
  }

  const qualityCopy =
    report.dataQuality === "insufficient"
      ? `Log a few more days for ${dogName} before comparing patterns.`
      : report.dataQuality === "limited"
        ? "A short baseline: keep logging to make these comparisons stronger."
        : "Based on your recent care logs and the previous two weeks.";

  return (
    <section
      aria-labelledby={headingId}
      className="mb-6 rounded-3xl border border-warm-brown/10 bg-white p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-text-muted">
            Insights
          </p>
          <h2
            id={headingId}
            className="font-fraunces text-xl font-bold text-warm-brown"
          >
            What’s changing for {dogName}
          </h2>
          <p className="mt-1 max-w-md text-xs leading-relaxed text-text-muted">
            {qualityCopy}
          </p>
        </div>
        <span className="rounded-full bg-light-tan px-3 py-1 text-[11px] font-semibold text-warm-brown">
          {report.dataQuality === "good"
            ? "Good data"
            : report.dataQuality === "limited"
              ? "Limited data"
              : "Need more logs"}
        </span>
      </div>

      {report.insights.length === 0 ? (
        <p className="mt-4 rounded-2xl bg-cream p-4 text-sm text-text-muted">
          No patterns to compare yet. Keep logging meals, walks and toilet
          breaks.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {report.insights.map((insight) => {
            const styles = SEVERITY_STYLES[insight.severity];
            const saved = submitted[insight.id];

            return (
              <li
                key={insight.id}
                className={`rounded-2xl border p-4 ${styles.card}`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${styles.badge}`}
                  >
                    {styles.label}
                  </span>
                  <span className="text-[10px] font-medium uppercase tracking-wide text-text-muted">
                    {confidenceLabel(insight.confidence)}
                  </span>
                </div>

                <h3 className="mt-2 font-semibold text-text-dark">
                  {insight.title}
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-text-muted">
                  {insight.detail}
                </p>

                <dl className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-white/70 p-2.5">
                    <dt className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                      Recent
                    </dt>
                    <dd className="mt-0.5 text-sm font-semibold text-text-dark">
                      {insight.currentLabel}
                    </dd>
                  </div>
                  <div className="rounded-xl bg-white/70 p-2.5">
                    <dt className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                      Baseline
                    </dt>
                    <dd className="mt-0.5 text-sm font-semibold text-text-dark">
                      {insight.baselineLabel}
                    </dd>
                  </div>
                </dl>

                <p className="mt-3 text-xs leading-relaxed text-text-muted">
                  {insight.recommendation}
                </p>

                {onFeedback && insight.kind !== "logging" && (
                  <div className="mt-3 border-t border-warm-brown/10 pt-3">
                    {saved ? (
                      <p
                        role="status"
                        className="text-xs font-medium text-emerald-800"
                      >
                        Thanks — saved. This helps Loggi learn what is normal for{" "}
                        {dogName}.
                      </p>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[11px] text-text-muted">
                          Does this match what you’re seeing?
                        </span>
                        <button
                          type="button"
                          disabled={pendingId === insight.id}
                          onClick={() =>
                            void handleFeedback(insight, "normal")
                          }
                          className="rounded-lg border border-emerald-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-50 disabled:opacity-50"
                        >
                          Looks normal
                        </button>
                        <button
                          type="button"
                          disabled={pendingId === insight.id}
                          onClick={() =>
                            void handleFeedback(insight, "unusual")
                          }
                          className="rounded-lg border border-rose-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-rose-800 hover:bg-rose-50 disabled:opacity-50"
                        >
                          Something’s off
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {error && (
        <p role="alert" className="mt-3 text-xs text-rose-700">
          {error}
        </p>
      )}

      <p className="mt-4 text-[11px] leading-relaxed text-text-muted">
        These are general pattern observations based on what has been logged.
        They are not veterinary advice or a diagnosis. If you are worried about{" "}
        {dogName}, contact your veterinarian.
      </p>
    </section>
  );
}
