# Loggi — trial acquisition and online launch plan

*19 November 2026 · practical plan for the first 100 trial households*

This is the execution companion to [market-analysis.md](market-analysis.md).
The market analysis explains the opportunity and unit economics; this document
is about getting real households into the app and learning from them.

## 1. The offer and the ask

Do not lead with "an app for logging dog care". Lead with the moment of pain:

- **"Who fed the dog?"** — coordination for multi-person households.
- **"Know when the next pee is due — before the puddle."** — puppy potty
  training.
- **"The handover that actually works."** — sitters, grandparents, walkers.

For the first cohort, make the ask small and the value obvious:

- **Founding trial:** 30 days free, no card, personal setup call, and a
  founding-household price locked if they stay.
- **Concierge onboarding:** 15 minutes to add the dog, invite the second person
  and log the first event. This is the highest-leverage growth activity at this
  stage.
- **One clear activation event:** dog added + first care event + second member
  joined within 48 hours.

The existing app starts a 14-day Stripe trial. For a hand-recruited founding
cohort, an operator-issued extended trial or a free beta household is usually
better than sending strangers straight to Checkout. Keep the paid trial for
self-serve traffic once activation is proven.

## 2. Where to find the first 100 households

Ranked by intent and cost, not reach:

| Rank | Channel | Why it works | First action |
| --- | --- | --- | --- |
| 1 | Your own network and WhatsApp groups | Fastest feedback, highest trust | Ask 20 people who own or share a dog to try it for a week |
| 2 | Breeders, puppy classes and trainers | They meet new owners in week one, exactly when potty anxiety peaks | Offer a free household + a co-branded handout; ask for 3 introductions |
| 3 | Rescues and foster networks | Handover and routine continuity are real pains | Offer free founding households to foster coordinators |
| 4 | Vets and vet nurses | Credible, but slow and cautious about health claims | Ask for a waiting-room QR card, not an endorsement |
| 5 | Local Facebook groups and subreddits | High intent, but rules matter | Contribute help first; ask mods before posting; never spam |
| 6 | TikTok/Instagram organic | Shows the "who fed the dog" moment in 10 seconds | Post 3 short demos per week for 4 weeks |
| 7 | SEO | Compounding, slow | Publish "puppy potty schedule", "who fed the dog", "dog care handover" pages |
| 8 | Product Hunt / founder communities | A spike, not a channel | Launch only after onboarding is smooth |
| 9 | Dog parks, cafes and grooming salons | Local, cheap, offline | QR card with a one-line offer |

Do not start with paid social. The market analysis's own gate is **30-day
household retention > 35%** before scaling spend. At a €15–30 CAC against a
~€38 net annual LTV, paid acquisition only works after activation and retention
are proven.

## 3. A 30-day trial-acquisition sprint

### Week 1 — recruit and observe

- List 50 warm contacts and 20 partner prospects (breeders, trainers, rescues,
  vets, groomers).
- Personally onboard 10 households. Watch where they hesitate; write down the
  exact words they use.
- Instrument the funnel (see §5) before inviting anyone.
- Post two organic videos: one "who fed the dog" skit, one screen-recorded
  potty prediction demo.

**Goal:** 10 activated households, 5 completed 15-minute interviews, 3 partner
conversations.

### Week 2 — partner loop

- Give 3 breeders/trainers a unique invite code and a simple handout.
- Ask each partner for one introduction, not a public endorsement.
- Publish two SEO pages and one comparison page ("Loggi vs a shared note").
- Run a €10/day test for 5 days on the best organic video, if you have budget;
  otherwise keep it organic.

**Goal:** 25 activated households, 2 partners actively referring, first
free-to-paid conversion.

### Week 3 — content and proof

- Turn the best 3 interview quotes into short posts (with permission).
- Post a "week in the life of a shared dog household" carousel and a
  before/after potty-training story.
- Add a simple waitlist/lead form for people who are not ready to install.
- Ask every activated household to invite the second person; make that the
  headline ask.

**Goal:** 50 activated households, invite rate ≥1.2 per household.

### Week 4 — decide

- Review activation, 7-day retention, invite rate and free-to-paid.
- Kill the channels above €30 CAC per activated household.
- Double down on the one partner channel that produced activated households,
  not the one with the most likes.
- Decide whether to open self-serve signups or keep the founding cohort
  concierge-led.

**Goal:** 100 trial households, a repeatable first message, and enough data to
choose the next channel.

## 4. Content that actually demonstrates the product

Short-form video works when it shows a real moment, not a feature list.

### Ten hooks

1. "POV: three people share one dog and nobody knows who fed him."
2. "The 2 a.m. puppy pee schedule, explained without a spreadsheet."
3. "My partner and I stopped arguing about the dog in one week."
4. "What a dog sitter actually needs handed over."
5. "I logged every pee for 7 days. Here's what the pattern showed."
6. "The 'who's on duty' screen that saved our Sunday lie-in."
7. "If you share a dog, you need one source of truth, not 400 messages."
8. "Puppy accident at 2pm? Here's the likely window, not a lecture."
9. "A vet-ready care report in two taps."
10. "We gave 10 households the app for a week. Here's what changed."

### Formats

- **Screen recording + voiceover** (10–20s): log an event, show the other
  person receiving it.
- **Two-person skit** (15–25s): the "did you feed the dog?" argument, resolved
  by the app.
- **Founder diary** (20–40s): building in public, one honest lesson per week.
- **UGC-style testimonial** (15–30s): a real trial household, with permission.
  No scripted fake reviews.

### Cadence

- TikTok: 3–5 posts/week, one idea per video, reply to comments with a video.
- Instagram: Reels first, carousel repurposing, Stories for polls/questions.
- Cross-post the same asset; do not rebuild for each platform.
- One CTA per post: "Try it free" or "Comment 'pack' and I'll send the link."

AI-assisted content is fine, but **disclose realistic AI-generated people or
scenes** and never invent a customer, a result or a veterinary claim. TikTok
requires AI-generated content labels for realistic content; Meta requires
disclosure for certain AI-edited political/social-issue ads and prohibits
deceptive practices generally. See the policy links in §7.

## 5. Track the funnel before spending money

The app currently has no product analytics. Add one lightweight tool
(Plausible, PostHog Cloud or a small Supabase events table) and record:

| Event | Properties |
| --- | --- |
| `signup_started` | source, UTM campaign |
| `signup_completed` | user_id, source |
| `household_created` | household_id |
| `dog_added` | dog_count |
| `first_event_logged` | event_type |
| `second_member_joined` | household_id |
| `trial_started` | plan |
| `paid` | plan, amount |
| `invite_copied` | household_id |

Derived activation: `dog_added` + `first_event_logged` +
`second_member_joined` within 48 hours. This is the number to optimise, not
installs.

Use UTM links for every channel:

```text
https://loggidogs.vercel.app/?utm_source=tiktok&utm_medium=organic&utm_campaign=puppy-potty-01
```

The app currently ignores UTM parameters, so preserve them on signup (e.g. store
them in a `profiles`/`acquisition` column or send them to analytics). Otherwise
you will know which video got views but not which one produced households.

## 6. Running ads with AI: what is realistic

### What an AI agent can do well

- Generate hooks, scripts, captions, ad copy and landing-page variants.
- Produce creative briefs and edit short videos; generate voiceover and
  subtitles.
- Build a content calendar and repurpose one asset across TikTok, Reels and
  Shorts.
- Pull campaign/ad-set/ad performance from the official APIs and produce a
  weekly report.
- Recommend budget shifts, pause clearly underperforming ads, and draft new
  variants — with a human approving spend.
- Write and maintain the tracking plan and UTM taxonomy.

### What it cannot do without a human and platform approval

- Create or verify a TikTok for Business / Meta Business account, business
  verification, payment method or tax details.
- Get `ads_management`/Marketing API access or a TikTok advertiser token without
  the account owner authorising the app and completing platform review.
- Post to TikTok/Instagram on your behalf without an approved app, the right
  scopes and a connected professional account.
- Guarantee platform policy compliance. AI-generated content, health claims and
  testimonials are exactly where accounts get restricted.

### The safe automation path

1. **Start manual.** Run the first €300–€500 yourself in Meta Ads Manager and
   TikTok Ads Manager. Learn which hooks and audiences survive.
2. **Create a Meta developer app** and request Marketing API access. Meta's
   current access tiers require app review and a minimum volume of successful
   API calls; do not automate before you have a working ad account. See
   [Meta Marketing API access](https://developers.meta.com/blog/updates-to-ads-management-standard-access-feature/).
3. **Create a TikTok for Business developer account** and obtain an advertiser
   access token through OAuth. See
   [TikTok advertiser access token](https://business-api.tiktok.com/portal/docs/obtain-an-advertiser-access-token/v2.0).
4. **For organic posting**, use the official TikTok Content Posting API
   (`video.publish` scope, app audit, domain verification) and the Instagram
   Graph API (professional account, `instagram_content_publish`, app review).
   Expect weeks, not hours, for approval. See
   [TikTok Content Posting API](https://developers.tiktok.com/docs/en/content-posting-api-get-started)
   and [Instagram publishing](https://developers.facebook.com/docs/instagram-platform/content-publishing).
5. **Do not use browser bots or unofficial "AI runs my account" tools.** They
   violate platform terms and put the ad account at risk. Meta explicitly ties
   automation to its official APIs.
6. **Disclose AI content** where required. See
   [TikTok's AI disclosure guidance](https://blog.hootsuite.com/ai-disclosure-policy-for-tiktok/)
   and [Meta's AI disclosure rules](https://business.facebook.com/business/help/1486382031937045).

### A practical division of labour

| Task | AI | Human |
| --- | --- | --- |
| Hooks, scripts, captions | Drafts 20 variants | Picks the 3 to shoot |
| Video editing | Rough cuts, captions, voiceover | Final review, disclosure |
| Campaign setup | Drafts structure and copy | Creates/approves in Ads Manager |
| Budget changes | Recommends | Approves spend |
| Reporting | Pulls API data, writes weekly summary | Decides next test |
| Compliance | Flags risky claims | Final sign-off |

## 7. Budget and decision rules

- **Organic first:** €0 for 4 weeks; spend time on 12 videos and 20 partner
  conversations.
- **Paid test:** €10–15/day per platform, 3 creatives, 7-day learning window.
- **Kill rule:** pause an ad set above €30 CAC per **activated household** after
  €150 spend.
- **Scale rule:** increase budget 20–30% only when CAC is below €20 and 7-day
  retention is above 40%.
- **Do not scale** until 30-day household retention is above 35% and the
  second-member invite rate is above 1.2.

## 8. First ten actions

1. Write the one-line offer and the founding-household terms.
2. List 50 warm contacts and 20 partner prospects.
3. Instrument the funnel and UTM capture.
4. Onboard 10 households personally this week.
5. Record two demo videos: "who fed the dog" and "next pee window".
6. Ask 3 breeders/trainers for a trial-code handout.
7. Publish one SEO page and one comparison page.
8. Ask every activated household to invite the second person.
9. Run a 7-day €10/day ad test only if the organic hook gets traction.
10. Review activation, retention and invite rate; kill what did not work.

## Sources

- [Market analysis and revenue scenarios](market-analysis.md)
- [Stripe Tax pricing](https://stripe.com/tax/pricing)
- [Supabase custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp)
- [Resend pricing](https://resend.com/pricing)
- [Meta Marketing API access changes](https://developers.meta.com/blog/updates-to-ads-management-standard-access-feature/)
- [TikTok advertiser access token](https://business-api.tiktok.com/portal/docs/obtain-an-advertiser-access-token/v2.0)
- [TikTok Content Posting API](https://developers.tiktok.com/docs/en/content-posting-api-get-started)
- [Instagram content publishing](https://developers.facebook.com/docs/instagram-platform/content-publishing)
- [TikTok AI disclosure guidance](https://blog.hootsuite.com/ai-disclosure-policy-for-tiktok/)
- [Meta AI disclosure rules](https://business.facebook.com/business/help/1486382031937045)
