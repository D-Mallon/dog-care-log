# Loggi — how the care commentary works

*Last updated: 20 November 2026*

This document explains what the app currently does when it shows “what’s
changing”, “next potty window”, “accident pattern” or a weekly summary. It is
written to match the code, not the roadmap.

## The short answer: there is no trained model in production

The commentary is **deterministic, rule-based statistics** computed in the
browser from the household’s own logs. There is no neural network, no
cross-dog learning and no diagnosis.

The “ML Phase 1” work added two foundations, not a model:

- [`mlFeatures.ts`](../src/lib/mlFeatures.ts) builds versioned, PII-free feature
  snapshots per dog (rates, potty outcomes, intervals, time-of-day shares,
  weight trend) for **future offline analysis**. It is not imported by any
  screen today.
- [`InsightFeedback`](../supabase/migrations/20261110000100_insight_feedback.sql)
  stores owner responses (“Looks normal” / “Something’s off”) as future labels.
  They do **not** change today’s output.

There is also an older [`predictions.ts`](../src/lib/predictions.ts) engine that
computes median pee intervals and morning-poo averages. It is covered by tests
but is **not wired into the app**; the profile uses `summarizePotty()` instead.

## 1. The main insight engine: `healthBaseline.ts`

File: [`src/lib/healthBaseline.ts`](../src/lib/healthBaseline.ts)

### Windows

- **Recent:** the last **3 days** (now minus 3 days to now).
- **Baseline:** the **previous 14 days**, ending exactly where the recent window
  starts, so a recent event can never inflate its own baseline.
- Days are **local calendar days**.
- “Active day” means a day with at least one care event. Rates are divided by
  active days, not by all 14 days, to reduce the effect of days with no logging.

### Minimum data before it compares anything

From the constants at the top of the file:

| Requirement | Value |
| --- | --- |
| Minimum baseline active days | 5 |
| Minimum recent active days | 2 |
| “Good” baseline | 10 active days |
| High confidence | 10 baseline active days **and** 20 baseline events |
| Medium confidence | 7 baseline active days |
| Otherwise | low confidence |

If the minimums are not met, the app shows a **“More logging days needed”**
insight instead of inventing a pattern. Data quality is labelled
`insufficient`, `limited` or `good`.

### What it compares

| Signal | Rule | Severity |
| --- | --- | --- |
| Feeding / water / walking | Recent rate per active day is ≤50% or ≥180% of baseline, with a minimum absolute change of 0.5–1 per day | `attention` only for a large sustained drop; otherwise `watch` |
| Potty accidents | Recent accident rate is more than **2×** baseline, or baseline was 0 | `attention` if baseline was 0 and there were ≥2 recent accidents, or if ≥2 recent and ≥3× baseline; otherwise `watch` |
| Potty success rate | Recent success rate is **≥20 percentage points lower** than baseline, with at least 2 recent and 4 baseline classified outcomes | `watch` |
| Toilet interval | Median interval is **≥50% longer or shorter** and differs by at least 0.5 hours, with at least 2 intervals in each window | `watch` |
| Weight | Latest weight differs from baseline median by **≥5%**; ≥10% is `watch`, 5–10% is `info` | `info` / `watch` |
| Nothing changed | A “Patterns look steady” insight | `info` |

At most **4 insights** are shown. They are sorted by severity
(`attention` → `watch` → `info`), then confidence
(`high` → `medium` → `low`), then id.

### The “two or three accidents” example

Suppose a dog has:

- **3 accidents in the last 3 days**, on 2 active days → recent rate = 1.5 per
  active day.
- **1 accident in the previous 14 days**, on 7 active days → baseline rate ≈
  0.14 per active day.

The recent rate is more than 10× baseline, and there are ≥2 recent accidents,
so the accident insight is `attention` and the title is **“Potty accidents are
above baseline”**. The card also shows “3 accidents in 3 days” vs “0.14 per
active day”, a confidence label, and the recommendation to watch whether it
continues and contact a vet if worried.

If instead there were **2 accidents on 2 active days** (1.0/day) and a baseline
of 0.14/day, it is still >2× baseline and ≥2 accidents, but not ≥3× baseline, so
it is `watch` rather than `attention`. A single accident is capped at low
confidence and never reads as a high-confidence pattern.

If the baseline was **0 accidents**, any recent accident triggers the card; two
or more make it `attention`. This is intentionally sensitive, because a new
accident pattern is worth noticing — but it is also why the copy says “pattern
observation, not veterinary advice.”

## 2. The potty dashboard: `pottyTraining.ts`

File: [`src/lib/pottyTraining.ts`](../src/lib/pottyTraining.ts)

This is the card on the dog profile with “Next potty window”, “Successes today”,
“Accidents today”, “7-day success”, “Accident pattern” and tips.

- It uses the **last 7 days** of toilet events.
- `pottyOutcome` is authoritative. Legacy events fall back to `isAccident`.
  Events with neither field are **unclassified** and are not silently counted as
  successes.
- **Success rate** = successes ÷ (successes + accidents) over 7 days.
- **Median interval** uses successful pee events when structured outcomes
  exist, otherwise all toilet events. Intervals below 15 minutes or above 12
  hours (puppy) / 24 hours (adult) are ignored.
- **Next window** = last toilet time + median interval, with a **±30 minute**
  window. If there is no interval history, it uses an age-based default:
  1.5 hours under 3 months, 2.5 hours under 6 months, 3.5 hours under 12 months,
  5 hours for an adult/unknown age.
- **Confidence**: high with ≥5 intervals and ≥5 successes; medium with
  ≥2 intervals and ≥3 recent toilet events; otherwise low. Puppies are capped
  one level lower because their cadence changes quickly.
- **Accident pattern** only appears with **2+ accidents** in the window. It
  computes the median gap between each accident and the preceding toilet break,
  and says something like “accidents tended to happen about 1.5h after the last
  toilet break.” One accident is treated as anecdote, not a pattern.
- **Tips** are rule-based: puppy frequency guidance, “log more data” when there
  are fewer than 3 events, accident-cluster advice at 2+ accidents, a
  single-accident reassurance message, and positive reinforcement when the dog
  asks to go out or the success rate is ≥80%.

The next-window status is `Overdue`, `Due soon` (within the next hour) or
`Upcoming`.

## 3. The weekly report: `weeklyReport.ts`

File: [`src/lib/weeklyReport.ts`](../src/lib/weeklyReport.ts)

This is a separate seven-day summary, not the same as the 3-day baseline. It
counts events, success rate, active days, per-dog consistency, weight trend and
highlights/concerns. It is also rule-based and uses the same “not veterinary
advice” disclaimer.

## 4. What the commentary does **not** do

- It does not diagnose, treat or rule out illness. The UI says this repeatedly.
- It does not compare one dog with another dog or with breed averages.
- It does not learn from the “Looks normal” / “Something’s off” feedback yet.
  Those rows are stored for future evaluation.
- It does not specifically bucket accidents by time of day in the baseline.
  The baseline compares rates across the 3-day and 14-day windows. Time-of-day
  shares and night potty counts exist only in the unused ML feature snapshot.
- It cannot correct for selective logging. If a household logs more carefully
  when worried, rates can move for logging reasons as well as care reasons.
  Dividing by active days reduces, but does not eliminate, this bias.
- It is not a trained model, so there is no probability, no learned threshold
  and no per-dog personalisation beyond the dog’s own recent history.

## 5. Why this design is reasonable for now

- It is **explainable**: every card shows recent vs baseline and a confidence
  level.
- It handles **cold start** without pretending to know: it asks for more logs.
- It avoids **health claims** that would need clinical validation.
- It gives us a **baseline to beat** once there is enough labelled data.

## 6. How to evaluate or evolve it

1. **Measure classification quality first.** What share of toilet events have a
   success/accident outcome? Without that, success-rate insights are noisy.
2. **Accumulate owner-confirmed labels.** Use `InsightFeedback` and, eventually,
   a vet-confirmed subset.
3. **Evaluate a simple model against this baseline** on precision, recall,
   false-alarm rate and lead time. Do not replace the baseline until it wins.
4. **Add time-of-day and weekday features** only if they improve validation.
   The feature snapshot already has morning/evening/weekend shares and night
   potty counts.
5. **Keep the copy non-diagnostic** and vet-reviewed.

## 7. Quick code/test map

| Concern | File |
| --- | --- |
| 3-day vs 14-day baseline, thresholds, confidence | [`healthBaseline.ts`](../src/lib/healthBaseline.ts) |
| Potty dashboard, next window, tips, accident pattern | [`pottyTraining.ts`](../src/lib/pottyTraining.ts) |
| Seven-day report | [`weeklyReport.ts`](../src/lib/weeklyReport.ts) |
| Future ML feature rows (not wired in) | [`mlFeatures.ts`](../src/lib/mlFeatures.ts) |
| Owner feedback labels | [`insightFeedbackApi.ts`](../src/lib/insightFeedbackApi.ts) |
| Legacy/unused predictions | [`predictions.ts`](../src/lib/predictions.ts) |
| Tests | `src/lib/__tests__/healthBaseline.test.ts`, `pottyTraining.test.ts`, `weeklyReport.test.ts`, `mlFeatures.test.ts` |
