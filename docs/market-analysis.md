# Loggi — Market Analysis

*10 November 2026 · Ireland → Europe → USA · pre-revenue PWA · not legal, tax or investment advice. Facts are cited; **(est.)** marks an assumption with its reasoning shown.*

## 1. Executive summary

- **Real but narrow.** Ireland: ~563k dogs, ~25% of households; Europe: 91m dogs, 140m pet households; USA: 71m dog households in a $158bn market. ([FEDIAF](https://europeanpetfood.org/about/statistics/), [APPA](https://americanpetproducts.org/news/u.s.-pet-industry-reaches-158-billion-in-2025-poised-for-continued-growth-in-2026))
- **Genuine wedge.** Loggi combines a shared log with attribution, explainable potty prediction and a free one-dog tier. Training apps sell content, vet apps are clinic-controlled, potty apps single-user.
- **Ireland is a testbed.** €100k ARR at €29 needs ~3,450 payers: ~15% of Ireland's two-year new-owner pool (est.), but ~0.03% of Irish + UK dog households. The UK is the first real market.
- **Pricing and retention risk.** €79 lifetime undercuts Wag ($299) and Dogo ($299.99) but anchors low; Puddle's $9.99 one-time app is the sharper threat. Potty training lasts 8–24 weeks, so if Loggi is only a puppy notebook, churn arrives when training ends.
- **Base rates.** Top 5% of new subscription apps made ~$8,880 in year one; median revenue per install was $0.31 after 60 days. ([RevenueCat](https://www.revenuecat.com/state-of-subscription-apps-2025/))
- **Path.** Six-month Irish validation via breeders/trainers/puppy classes; annual plan hero; lifetime capped at 100–200; no paid social until 30-day retention is proven.
- **Realistic revenue.** €3k–€10k ARR in 12 months (est.; base ~€6k); €20k–€80k by year 3 on Ireland + UK (est.); €100k+ only with wider Europe (and possibly the US) and 3,450+ payers. Stay capital-light.

## 2. Market context

| Metric | Ireland | Europe | USA |
|---|---|---|---|
| Dogs | 563,000 (FEDIAF, 2024 data) | 91m (FEDIAF) | ~90m (est.) |
| Dog-owning households | ~25% (FEDIAF); ~490k (est.: 563k ÷ 1.15 dogs/HH) | ~70m (est.: 91m ÷ 1.3) | 71m (APPA, 2025) |
| Pet spend | €8.79/week per household ≈ €457/year ([CSO](https://data.cso.ie/table/HBS01)) | €29.4bn pet food, 2024 | $158bn 2025 → $165bn 2026 (APPA) |
| New dogs/year | ~51k (est.: 563k ÷ 11-year lifespan) | ~8.3m (est.) | ~8m (est.) |

Ireland has no official pet census: FEDIAF's Irish figures are modelled, and 208,699 dog licences (2024) are a floor. ([DAFM](https://assets.gov.ie/static/documents/b64e6488/DAFMControlofDogsStatisticsReport2024FINAL131125.pdf)) Dogs Trust's 2025 census (22,366 owners, weighted to Ipsos B&A) adds: 74% one dog; 27% breeder, 27% rescue; 31% no research; 36% struggle with vet bills. ([Dogs Trust](https://www.dogstrust.ie/what-we-do/irelands-dog-census-2025))

Europe's 49% pet-ownership rate hides huge variation (25% of Irish households vs 70% of Spanish). The UK is the obvious second market: same language, 36% dog-owning households, and Rover already operates in both markets; it bought Gudog in 2025. ([FEDIAF](https://www.zzf.de/fileadmin/ZZF/Dokumente/Heimtiermarkt/FEDIAF_Facts_Figures_2026.pdf), [Rover](<https://en.wikipedia.org/wiki/Rover_(American_company)>)) The US is the biggest prize; 22% of owners spent less in 2025. ([APPA](https://americanpetproducts.org/news/u.s.-pet-industry-reaches-158-billion-in-2025-poised-for-continued-growth-in-2026))

Pet tech is $9.2bn (2025), growing 12.5% to $23.5bn by 2033 — mostly wearables, GPS and smart feeders, not logging software. ([Grand View](https://www.grandviewresearch.com/industry-analysis/pet-tech-products-market-report))

## 3. Customer and jobs-to-be-done

| Segment | Job | Pain today | Willingness to pay |
|---|---|---|---|
| First-time puppy owner (8–24 weeks) | "When is the next pee due, and are we improving?" | Anxiety, night wakes, conflicting advice | Highest at the moment of need; needs post-training value |
| Multi-person household | "Who fed/walked the dog, and who is next?" | WhatsApp scroll, duplicated feeding, blame | Strongest payer; €29/year is trivial split across adults |
| Housesitter / walker / grandparent | "What is the routine, and what happened today?" | Verbal handover, lost context | Low alone; high as an invited user who pulls the owner in |
| Rescue adopter | "What is normal for this dog?" | Unknown history, behaviour surprises | Moderate; often adult dogs, so potty value is lower |

**Why logs fail.** WhatsApp is a stream, not a record: no attribution, no "next due". Shared notes have no domain model — no potty subtypes, weight history or predictions. Training apps sell lessons, vet apps are appointment-shaped, and single-user potty apps miss the handover.

**Willingness to pay.** €29/year is ~6% of average Irish household pet spend, but the anchors are bad: Puddle charges $9.99 once, and WhatsApp/Notes are free. Wag's $59.99/year works because it saves members money; Loggi saves coordination effort, which is harder to prove. Annual beats monthly because it matches the puppy project's horizon.

## 4. Competitor landscape

| Player | Positioning | Public pricing | Strengths | Weaknesses vs Loggi | Stores |
|---|---|---|---|---|---|
| **Rover** | Sitter/walker/boarding marketplace | Owners pay 15%, capped €49/booking; sitters keep 85% ([Rover](https://hilfe-de.rover.com/hc/en-gb/articles/360023783412-What-are-the-service-fees)) | Brand, supply, Gudog, GoodPup | Transactional; no daily log | iOS, Android, web |
| **Wag!** | Marketplace + Premium | $5.99/mo, $59.99/yr, $299 lifetime ([Wag](https://wagwalking.com/wag-premium)) | Discounts, vet chat | Savings, not coordination | iOS, Android, web |
| **11pets** | Health record/tracker | Free + IAP $1.99 and $17.99 ([11pets](https://apps.apple.com/us/app/11pets-pet-care/id1232470530)) | Records, reminders, multi-pet | Clinical UX, weak co-ordination, 3.3/5 | iOS, Android, web |
| **PetDesk** | Vet-clinic client app | No owner subscription; clinics pay ([PetDesk](https://petdesk.com/)) | Vet channel, reminders | Clinic-controlled; no shared log | iOS, Android, web |
| **Dogo / Puppr** | Training content + clicker/tricks | Dogo: free + IAP; lifetime $299.99 ([Dogo](https://apps.apple.com/us/app/dogo-dog-training-clicker/id1153294767)); Puppr $12.99/mo or $99.99/yr ([Puppr](https://play.google.com/store/apps/details?id=com.chinandcheeks.dogtrainer)) | Large installs, content | Content-led; no attribution | iOS, Android |
| **GoodPup** | 1:1 live video training | Rover subsidiary; pricing not retrievable ([Rover](<https://en.wikipedia.org/wiki/Rover_(American_company)>)) | Human coaching | Expensive, no log | iOS, Android, web |
| **Puddle** | Puppy potty log + prediction | Free for one puppy; Pro $9.99 once ([Puddle](https://apps.apple.com/us/app/puddle-puppy-potty-log/id6764225310)) | Cheap, private, explainable | Single-user, local-only, iOS only | iOS |
| **Notes / WhatsApp** | Default coordination | Free | Universal, free | No structure or prediction | All |

**The wedge.** Household coordination is the moat, not the ML. Explainable "due/overdue + why" lets a partner or sitter act without reading a chart — keep the ML honest ("based on the last 5 toilet breaks and age", not "AI").

**Exposure.** Puddle suggests the potty job can be sold once for $9.99, undermining a €29/year subscription for the same job. Rover/Wag could add a log; 11pets could add household sharing. A second recurring job (sitter handover, health notes) is needed to survive month six.

## 5. Market sizing and revenue model

**Assumptions.** SAM = two-year new-dog cohort × 65% multi-person × 35% app-considering (est.). TAM = every dog-owning household pays €29/year. SOM = three-year capture; free-to-paid 2–4% (est.). ARPU €29 (est.), blended (monthly treated at the annual price for conservatism).

| Layer | Ireland | Ireland + selected Europe* | Europe + USA |
|---|---|---|---|
| Dog-owning households | ~490k (est.) | ~14.5m (est.) | ~141m (est.) |
| Two-year new-dog cohort | ~102k (est.) | ~3.3m (est.) | ~32.6m (est.) |
| SAM households | ~23,200 | ~755,000 | ~7.4m |
| TAM at €29/yr (gross) | €14.2m | €420m | €4.1bn (mixed currency) |
| SAM at €29/yr (gross) | €673k | €21.9m | €215m |

\*UK, Ireland, Netherlands, Belgium, Denmark, Sweden, Norway, Finland; ~20% of Europe's dog population (est.).

**Scenarios (est.).**

| Geography | Paying HH (Y3): low / base / high | Gross ARR | Net revenue** | SAM capture |
|---|---|---|---|---|
| Ireland only | 150 / 400 / 900 | €4.4k / €11.6k / €26.1k | €3.3k / €8.7k / €19.6k | 0.6% / 1.7% / 3.9% |
| Ireland + selected Europe | 900 / 3,000 / 8,000 | €26.1k / €87.0k / €232.0k | €19.6k / €65.3k / €174.0k | 0.12% / 0.40% / 1.06% |
| Europe + USA | 3,000 / 10,000 / 30,000 | €87.0k / €290.0k / €870.0k | €65.3k / €217.5k / €652.5k | 0.04% / 0.14% / 0.40% |

\*\*Net of 23% VAT (assumed Irish standard rate) and ~2% payment fees; excludes hosting, refunds and tax. Lifetime is one-off cash, not ARR.

**Unit economics.** At €3.99/€29/€79, net after 23% VAT and ~1.5% + €0.25 fees (est.) is €2.93/€22.89/€62.79; at 60% annual churn (est.), annual net LTV is ~€38 (monthly ~€18). Annual is the only plan with a plausible paid case: at €15 CAC, annual LTV/CAC is ~2.5× (below a 3× target), monthly ~1.2×. Lifetime at €79 beats an annual subscriber's ~€48 gross LTV, so it raises cash — and should be capped. €100k ARR needs ~3,450 payers: ~15% of Ireland's two-year SAM, but ~0.03% of Irish + UK dog households. MRR = ARR ÷ 12 (base ~€7.3k). **Geography is the business decision.**

Churn: 55–65%/year (est.), base 60%; RevenueCat implies ~64% for cheap annual plans, so we assume only slightly better retention. Above 65%, scenarios fall further.

## 6. Likelihood of success

Qualitative assessment, not a modelled probability. Consumer subscription is a power law: RevenueCat's 2025 data (75,000 apps) shows the top 5% of new apps earning ~$8,880 in year one. €1m+ odds are low single digits (est.) without unusual distribution; a useful €10k–€50k ARR business is plausible (est.) if costs stay near zero and the founder keeps selling.

**My read:** this is a credible capital-light niche business, not yet a venture-scale bet. Reaching the first 100–300 paying households is plausible with disciplined partner selling; €1m+ ARR is a low-single-digit outcome without an unusual distribution advantage. The plan should be judged on retention and invited-household activation, not on downloads.

**More likely if:** invite rate >1.5 with >60% acceptance; 30-day retention >35%; prediction used 3+ times/week in week two; free-to-paid >3%, annual >50%; a partner channel drives >30% of signups at <€15 CAC; the founder sells 20–30 households/month.

**Less likely if:** Loggi becomes a temporary puppy notebook and churns at months 4–6; inviting a partner is harder than sending a WhatsApp; €10 one-time apps anchor the category; paid CAC lands at €25–40 against €38 net annual LTV; the roadmap chases the US and ML before Irish activation works.

| Leading indicator (weekly) | Green | Amber | Red |
|---|---|---|---|
| Activation: dog + first event + second member, 48h | ≥55% | 35–55% | <35% |
| 7-day retention (any event) | ≥50% | 30–50% | <30% |
| 30-day household retention | ≥35% | 20–35% | <20% |
| Invites per household, first 14 days | ≥1.5 | 1.0–1.5 | <1.0 |
| Free → paid within 14 days | ≥3% | 1.5–3% | <1.5% |
| Annual share of new subscriptions | ≥50% | 30–50% | <30% |
| Blended CAC / LTV:CAC | <€15 / ≥3× | €15–30 / 1.5–3× | >€30 / <1.5× |

## 7. Go-to-market plan

| Weeks | Actions | Success metric |
|---|---|---|
| 0–2 | Instrument install → household → event → invite → paid; 10 interviews; Stripe live checklist and legal pages; waitlist. | Interviews done; one funnel dashboard. |
| 3–6 | 15 partner talks (breeders, trainers, rescues, 2 vets); 3 puppy classes; 6 SEO pages; 2 TikToks/week; founding lifetime to 100. | 5 partners; 100 waitlist; 10 payers. |
| 7–13 | Invite loop; Product Hunt; 2 breeder codes; €300 paid test; weekly recap email; review cohorts and UK gate. | Invite rate ≥1.2; CAC <€25; 40 payers. |

**Channels.** Breeders/trainers meet owners in week one and are highest-intent; rescues are high-volume but often adult dogs; vets are credible but slow; puppy classes concentrate the buyer. SEO ("puppy potty schedule", "who fed the dog") compounds; TikTok/Instagram work for demo, not conversion. Referrals are the only structural CAC reduction; paid social waits for retention proof.

**Messaging.** Lead with **"Who fed the dog?"** and support with **"Know when the next pee is due — before the puddle."** Subhead: *"One shared log for every human who looks after your dog."* Test coordination vs potty headline, and lifetime above vs below pricing.

**Invite loop and lifetime.** Ask "Who else looks after the dog?" before the paywall. Invitees join free; the owner gets one month free per accepted invite (cap 3). Show "logged by [name]" and send a weekly recap. The €79 lifetime is capped at 100–200 with roadmap input: a pre-sale, not a permanent price; state fair use and a sunset clause.

**CAC and expansion.** Organic/partner CAC €5–15 (est.), paid social €20–40 (est.). Test €300 Meta/Instagram and €200 TikTok, measuring cost per *activated household*; kill any channel above €30 CAC after €500. UK first, then Netherlands/Nordics, then Germany/France. Do not enter the USA until 90-day retention is >35% and CAC payback is <6 months.

## 8. PWA vs app-store strategy

| Option | Cost | Discovery | Payments | Verdict |
|---|---|---|---|---|
| **PWA (current)** | Lowest; one codebase | None in stores | Stripe, full margin | Iteration speed beats store reach. |
| **Capacitor wrapper** | Moderate; reuse React | App Store + Play | Apple 15% under $1m; 10% on EU alternative terms and subscriptions after year one; Google 15% or less for most ([Apple](https://developer.apple.com/app-store/small-business-program/), [Google](https://support.google.com/googleplay/android-developer/answer/112622)) | Add when store presence is the bottleneck. |
| **Native** | Highest; two codebases | Stores | Store IAP | Not before product-market fit. |

A 15% store cut (€4.35 at €29) beats Stripe's ~€0.69, so PWA wins on margin. Stay PWA until 1,000 payers, or until iOS signups exceed ~40% and install friction hurts activation; then wrap with [Capacitor](https://capacitorjs.com/).

## 9. Regulatory and trust considerations

| Area | What applies | Practical action |
|---|---|---|
| **GDPR** | Names, emails, household roles and pet data linked to a person are personal data; contract is the likely basis, consent for marketing ([GDPR.eu](https://gdpr.eu/what-is-gdpr/)) | DPAs with Supabase/Stripe; retention policy; export/delete; 72-hour breach process. |
| **Consumer subscriptions** | EU distance-selling rules give a 14-day withdrawal right; narrow exceptions apply ([EU](https://europa.eu/youreurope/citizens/consumers/shopping/returns/index_en.htm)) | Clear renewal, easy cancellation, no dark patterns, VAT-inclusive prices, OSS. |
| **Health claims** | Do not diagnose, treat or claim to prevent illness | "Insights", not "detects"; "not veterinary advice"; no fear marketing. |
| **Stripe / stores / AI** | Test mode is not live mode; store rules apply only if native; explainable ML is a trust advantage | Finish live checklist and test €1; show prediction inputs and a readable "why". |

## 10. Recommendation

**Next 30 days.** Interview 15 customers (8 puppy owners, 4 breeders/trainers, 3 adopters). Instrument activation, invite and retention. Sign 5 partners and run 2 puppy-class nights. Finish live payments and legal pages; A/B the landing page; cap lifetime at 200.

**Measure.** Activation ≥55%; 7-day retention ≥50%; 30-day retention ≥35%; invite rate ≥1.5; free-to-paid ≥3%; annual share ≥50%; blended CAC ≤€15; LTV/CAC ≥3×. Review monthly.

**Kill criteria (month 6, ≤€5k spend).** Stop or pivot if any two hold: <150 activated households; <25 payers; 30-day retention <20%; invite rate <1.2; CAC >€40; LTV/CAC <1.5. A pivot to a breeder/trainer B2B2C tool is more credible than another consumer pivot.

**12-month target (est.) and decision.** 100–350 payers; €3k–€10k gross ARR (base ~€6k; stretch €15k). If green at month six, invest in the UK and add Capacitor; if amber, narrow to the best partner channel; if red, stop taking money. Loggi is a good €20k–€80k/year business or a credible seed for a larger platform — not an Ireland-only one at €29.

## Sources

- https://europeanpetfood.org/about/statistics/
- https://www.zzf.de/fileadmin/ZZF/Dokumente/Heimtiermarkt/FEDIAF_Facts_Figures_2026.pdf
- https://www.dogstrust.ie/what-we-do/irelands-dog-census-2025
- https://www.dogstrust.ie/downloads/Census%202025%20Report%20FINAL.pdf
- https://assets.gov.ie/static/documents/b64e6488/DAFMControlofDogsStatisticsReport2024FINAL131125.pdf
- https://data.cso.ie/table/HBS01
- https://americanpetproducts.org/news/u.s.-pet-industry-reaches-158-billion-in-2025-poised-for-continued-growth-in-2026
- https://www.grandviewresearch.com/industry-analysis/pet-tech-products-market-report
- https://www.revenuecat.com/state-of-subscription-apps-2025/
- https://hilfe-de.rover.com/hc/en-gb/articles/360023783412-What-are-the-service-fees
- <https://en.wikipedia.org/wiki/Rover_(American_company)>
- https://wagwalking.com/wag-premium
- https://apps.apple.com/us/app/11pets-pet-care/id1232470530
- https://petdesk.com/
- https://apps.apple.com/us/app/dogo-dog-training-clicker/id1153294767
- https://play.google.com/store/apps/details?id=com.chinandcheeks.dogtrainer
- https://apps.apple.com/us/app/puddle-puppy-potty-log/id6764225310
- https://developer.apple.com/app-store/small-business-program/
- https://support.google.com/googleplay/android-developer/answer/112622
- https://gdpr.eu/what-is-gdpr/
- https://europa.eu/youreurope/citizens/consumers/shopping/returns/index_en.htm
- https://www.revenue.ie/en/vat/vat-rates/index.aspx
- https://stripe.com/ie/pricing
- https://capacitorjs.com/
