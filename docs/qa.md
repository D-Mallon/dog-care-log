# Loggi — Release 1 QA checklist

Manual QA for **v0.1.0 / Release 1**. Run it against a Vercel preview (preferred) or a local build, using a **dev Supabase project** and **Stripe test mode**. The Vitest unit and component suites (49 tests) run in CI; end-to-end browser automation is a separate workstream and is not yet wired in.

> **Never run destructive QA against production data.** Use two fresh test accounts and test-mode payment details only.

## Test run details

| Field | Value |
| --- | --- |
| Commit / branch | |
| Environment (preview URL or local) | |
| Supabase project ref | |
| Stripe mode | Test |
| Tester | |
| Date | |
| Browser/device matrix completed | iOS ☐ Android ☐ Desktop ☐ |

## Before you start

- [ ] Two separate accounts are available: **User A** and **User B**.
- [ ] They use **separate browser profiles** (or separate devices). Do not test two users in two tabs of the same profile.
- [ ] A dev Supabase project is linked, migrations are applied, and the Edge Functions are deployed.
- [ ] Stripe is in **test mode**, prices are configured, and the webhook endpoint is receiving events.
- [ ] Stripe CLI forwarding is running: `stripe listen --forward-to <webhook-url>` (hosted: `https://<project-ref>.supabase.co/functions/v1/stripe-webhook`; local stack: `http://127.0.0.1:54321/functions/v1/stripe-webhook`).
- [ ] You have at least one test dog with a photo and a weight.
- [ ] Browser console and network panels are open; note any uncaught errors or failed requests.
- [ ] Record the commit SHA above so a failure can be reproduced.

### Result legend

- **PASS** — matches expected result.
- **FAIL** — does not match; file with steps, expected/actual, screenshot, console/network output and account used.
- **BLOCKED** — prerequisite missing (record why).
- **N/A** — not applicable to this run.

**Any P0/P1 blocks the release.** P0 examples: cross-household data leak, auth lockout, payment taken without entitlement, silent data loss. P1 examples: a core flow (sign-up, join, log, checkout) is broken for a supported surface.

---

## 1. Authentication

### 1.1 Sign-up and sign-in

- [ ] **A1 — Sign up User A.** Valid email and password. Account is created; the app either signs in or shows a clear "confirm your email" state, matching the project's email-confirmation setting.
- [ ] **A2 — Sign up User B.** Same, in the second browser profile.
- [ ] **A3 — Duplicate email.** Sign up again with A's email. Friendly error is shown; no crash, no session change.
- [ ] **A4 — Wrong password.** Sign in with a wrong password. Friendly error; no session; no stack trace.
- [ ] **A5 — Valid sign-in.** Sign out, then sign back in. Session persists across a reload.
- [ ] **A6 — Email confirmation (if enabled).** Unconfirmed account cannot access the app; confirmation link works; after confirmation sign-in succeeds.
- [ ] **A7 — Missing configuration.** With `VITE_SUPABASE_URL` or the publishable key missing/invalid, the app shows a friendly configuration error rather than a blank screen or an unhandled exception.

### 1.2 Session and account switching

- [ ] **A8 — Sign-out clears state.** Sign out as A. Reload; app stays signed out. Browser back does not reveal A's dogs, events or household.
- [ ] **A9 — Account switch does not leak.** From A, sign out and sign in as B. No A household, dog, event, weight, invite code or billing state is visible, even briefly.
- [ ] **A10 — Expired/revoked session.** Invalidate the session (or clear the auth token), then act. App returns to sign-in with a clear message; no blank screen or infinite spinner.
- [ ] **A11 — Stale responses.** Sign out while a slow request is in flight. The response must not repopulate the next user's state.

### 1.3 Password recovery

- [ ] **A12 — Request reset.** From "Forgot password", submit A's email. Email arrives (check spam); link uses an allowed redirect URL.
- [ ] **A13 — Recovery lands correctly.** Link opens the app and shows the **update password** form, not the normal home/setup screen.
- [ ] **A14 — Update password.** Set a new password; sign in with the new password; old password fails. No redirect loop.
- [ ] **A15 — Expired recovery link.** Old/used link shows a friendly error and a way back to sign-in.

---

## 2. Onboarding and household creation

- [ ] **B1 — First-run routing.** A newly signed-in user with no household sees the household setup screen. There is no flash of the home screen or of an empty dog list first.
- [ ] **B2 — Create household.** Enter a name, create. A becomes the owner and lands on the home screen.
- [ ] **B3 — Validation.** Empty/whitespace-only name is rejected with a clear message; a very long name is handled without breaking layout.
- [ ] **B4 — Reload persistence.** Reload as A. Same household is loaded; setup does not reappear.
- [ ] **B5 — One active household.** A cannot create or join a second household while already an active member of one. If the UI hides this, verify the server rejects a direct attempt (see §11).
- [ ] **B6 — Empty states.** Home shows a clear empty state for no dogs and no events; it does not look like a failed load.
- [ ] **B7 — Load failure.** Simulate a failed household/dog read (offline or bad token). A retryable error is shown; empty states are not shown as if the data were empty.

---

## 3. Household join, roles and membership (two users)

- [ ] **C1 — Copy invite code.** A copies the invite code (clipboard works; a fallback is offered if clipboard permission is denied).
- [ ] **C2 — Join as B.** B enters the code, joins, and sees the same household, dogs and events. A sees B in the member list.
- [ ] **C3 — Code normalization.** Lowercase, surrounding spaces and mixed case all work. Invalid characters do not crash the form.
- [ ] **C4 — Wrong code.** B (in a third account or after leaving) enters a wrong code. Friendly "code not found" error; no household data is leaked.
- [ ] **C5 — Duplicate join.** B tries to join again. Result is idempotent or a friendly "already a member" message; no duplicate membership row.
- [ ] **C6 — Owner-only actions.** As B (member), rename household, regenerate invite code, remove a member and delete a dog are unavailable or rejected. As A (owner), they work.
- [ ] **C7 — Rename.** A renames the household. B sees the new name after realtime/refetch.
- [ ] **C8 — Regenerate code.** A regenerates the code. The old code no longer joins; the new code does (use a third test account).
- [ ] **C9 — Member leaves.** B leaves. B immediately loses access and is returned to setup. A's member list no longer shows B. B's next read/write is denied.
- [ ] **C10 — Owner removes member.** A removes B. B's session loses access; B cannot read or write A's household data.
- [ ] **C11 — Last-owner safety.** The defined owner-leave/delete behaviour is enforced: a household is not left with no owner, and the UI explains what will happen before the action.
- [ ] **C12 — Invite-code secrecy.** A non-member who knows a household ID (not the code) cannot enumerate or join it; the join flow does not expose household names or member lists before joining.

---

## 3b. Dogs and the free-plan limit

- [ ] **B8 — First dog.** A free household can add its first dog with photo, breed, age, weight and notes.
- [ ] **B9 — Second dog blocked in UI.** With one dog and no plan, "+ Add a Dog" sends the user to Pricing with a clear explanation.
- [ ] **B10 — Second dog blocked in RLS.** A direct insert of a second dog for an unentitled household is rejected by the `Dogs` INSERT policy.
- [ ] **B11 — Premium unlocks dogs.** An active/trialing subscription allows a second and subsequent dog.
- [ ] **B12 — Cancellation does not delete dogs.** If a plan ends with multiple dogs, existing dogs and history remain; only new dogs are blocked.
- [ ] **B13 — Member behaviour.** A non-owner member sees the same limit and cannot bypass it by calling the API directly.

---

## 4. Care logging

- [ ] **D1 — Quick log each type.** Feed, water, walk, medication and grooming log in one action with the correct dog, type and timestamp.
- [ ] **D2 — Toilet subtypes.** Quick toilet logs pee, poo and accident variants correctly; the timeline shows the right subtype/accident marker.
- [ ] **D3 — Full form.** Log each event type through the full form, including a note and a toilet subtype/accident flag. Saved event matches the form.
- [ ] **D4 — Pending and duplicate prevention.** The quick-log control shows a pending state. Double-tapping or a slow response does not create duplicate events.
- [ ] **D5 — Failure is visible.** Make an insert fail (offline, revoked session, or blocked by RLS). A visible error is shown; no ghost event remains; retry works.
- [ ] **D6 — Logged by.** Events show "Logged by A" for A and "Logged by B" for B, using the membership display name.
- [ ] **D7 — Today's timeline.** Only today's events appear in the home timeline, newest first; another dog's events are not mixed in.
- [ ] **D8 — Overdue cues.** Feed, walk, toilet and medication cues reflect the last event and update after a new log. "Due" and "overdue" wording is correct.
- [ ] **D9 — Delete event.** Delete shows a confirmation. Cancel keeps the event; confirm removes it for both users after realtime/refetch.
- [ ] **D10 — Dog profile history.** The profile shows the correct event history and today's count for that dog only.

---

## 5. Backdating and editing events

- [ ] **E1 — Backdate earlier today.** Change "When" to an earlier time today. Event is saved with that timestamp and appears in today's timeline at the right relative time.
- [ ] **E2 — Backdate yesterday.** Save an event for yesterday. It is absent from today's timeline but present in history and CSV with the correct date/time.
- [ ] **E3 — Date/time validation.** Future timestamps and malformed/empty values are rejected with a clear message (or explicitly handled if future events are allowed by design).
- [ ] **E4 — Timezone/DST.** Log near local midnight and around a DST change. The event displays at the time the user entered, not shifted by a fixed offset.
- [ ] **E5 — Edit own event.** Change type, note and time. Changes persist after reload and are visible to the other household member.
- [ ] **E6 — Edit permissions.** A member cannot edit another member's event (unless the release decision explicitly allows owners to). The owner can perform the actions defined in the plan. Server denial is checked in §11.
- [ ] **E7 — Delete permissions.** The same author/owner rules apply to deletion.
- [ ] **E8 — Edited event consistency.** After an edit, the timeline, predictions/overdue cues, profile history and CSV all use the new value.

---

## 6. Realtime collaboration

- [ ] **F1 — New event.** With A and B both on the home screen, A logs an event. B sees it within ~5 seconds without reloading.
- [ ] **F2 — Edit and delete.** A edits and deletes an event. B's view updates for both.
- [ ] **F3 — Weight updates.** A logs a weight. B sees the updated weight/history.
- [ ] **F4 — Reconnect.** Put B offline, log events as A, bring B back online. B catches up on reconnect/focus without duplicates.
- [ ] **F5 — Background tab.** Background B's tab for a few minutes, log as A, return to B. B refetches and is current.
- [ ] **F6 — Membership revocation.** After B leaves or is removed, A's new events do not reach B; B's subsequent reads fail.
- [ ] **F7 — Two dog households.** Realtime events for multiple dogs are attributed and rendered correctly, with no cross-dog mixing.
- [ ] **F8 — No duplicate subscription leaks.** Repeated navigation or sign-in/out does not stack realtime subscriptions or duplicate events.

---

## 7. Weight tracking

- [ ] **G1 — Initial weight.** Adding a dog with a weight creates the initial weight log and shows it in history.
- [ ] **G2 — No weight, no fake log.** Adding a dog without a weight does not create a bogus `0` entry.
- [ ] **G3 — Dedicated entry.** Add a weight from the dog profile. The latest weight updates and history is ordered newest first.
- [ ] **G4 — Validation.** Zero, negative, non-numeric and absurdly large weights are rejected with a clear message.
- [ ] **G5 — Units.** The weight unit is labelled and consistent wherever weight is displayed or exported.
- [ ] **G6 — Persistence.** Weight survives reload and is visible to the other household member.
- [ ] **G7 — CSV.** Weight history appears in the export with correct values and timestamps.

---

## 8. CSV export

- [ ] **H1 — Export succeeds.** Download the CSV from the dog profile and the household-wide export from Account & data. Files download with sensible names.
- [ ] **H2 — Escaping.** Notes containing commas, double quotes and line breaks round-trip correctly.
- [ ] **H3 — Formula injection.** Values beginning with `=`, `+`, `-` or `@` are neutralised (for example, prefixed with `'` or otherwise escaped) so spreadsheet software does not execute them.
- [ ] **H4 — Encoding and line endings.** UTF-8 BOM and CRLF (or the documented choice) are present; accents, emoji and non-ASCII dog names render correctly in Excel and Numbers.
- [ ] **H5 — Dates/timezone.** Timestamps are correct in the user's local timezone and unambiguous.
- [ ] **H6 — Empty data.** A dog with no events exports a header-only file without crashing.
- [ ] **H7 — Scope.** The export contains only the current household's data. No other household's dog, event or weight appears.
- [ ] **H8 — Spreadsheet compatibility.** Open the file in Excel, Numbers and Google Sheets; columns align and no rows are silently merged.

---

## 8b. Account deletion and household export

- [ ] **H9 — Household export.** Account & data → Download household CSV contains every dog, event and weight entry, and nothing from another household.
- [ ] **H10 — Member deletion.** As a non-owner member, delete the account. Login is removed, the household remains for the owner, and the member can no longer access it.
- [ ] **H11 — Owner with members is blocked.** As an owner with another active member, deletion returns a clear "remove members/transfer ownership" message and deletes nothing.
- [ ] **H12 — Sole owner deletion.** As the only member, delete the account. Household, dogs, events, weights, memberships and the auth user are gone; the email can sign up again.
- [ ] **H13 — Subscription cancellation.** A paying owner with an active/trialing subscription is cancelled in Stripe before deletion; no further invoice is generated.
- [ ] **H14 — Storage cleanup.** Dog photos for the deleted household are removed from the `dog-images` bucket.
- [ ] **H15 — Failure handling.** A blocked deletion leaves the account usable and shows a retryable error; no partial household deletion is visible.

---

## 9. Offline, PWA and install

- [ ] **I1 — Install on iOS Safari.** Share → Add to Home Screen. Icon, name and standalone launch are correct; safe areas are respected.
- [ ] **I2 — Install on Android Chrome.** Menu → Install app. Icon, splash, standalone display and back behaviour are correct.
- [ ] **I3 — Desktop install.** Chrome/Edge install is available; window launches at the right scope.
- [ ] **I4 — Offline shell.** With the app previously loaded, go offline and reopen. The shell loads and cached read data is available; an offline banner/state is visible.
- [ ] **I5 — Offline writes are not queued.** Attempt to log an event/weight offline. A clear failure is shown; no ghost event appears; nothing is silently queued. Going back online does not replay a phantom write (Release 1 has no write queue).
- [ ] **I6 — Recovery.** Back online, refresh/retry; data is current and no duplicates exist.
- [ ] **I7 — Deploy update.** After a new deployment, the service worker updates without trapping the user on a stale shell; a reload picks up the new assets.
- [ ] **I8 — Manifest and icons.** Manifest name, `start_url`, `scope`, theme/background colours and 192/512 icons are correct; no missing-icon console errors.

---

## 10. Stripe billing (test mode only)

Use Stripe **test mode** keys and test cards. Confirm the webhook endpoint is receiving events before starting. Setup, products, secrets and webhook forwarding are covered in [docs/stripe-setup.md](stripe-setup.md).

| Card | Number | Purpose |
| --- | --- | --- |
| Visa success | `4242 4242 4242 4242` | Successful payment |
| Decline | `4000 0000 0000 0002` | Declined payment |
| 3D Secure | `4000 0025 0000 3155` | Authentication challenge |
| Insufficient funds | `4000 0000 0000 9995` | Decline after authentication |
| Fails on first charge | `4000 0000 0000 0341` | Useful for `invoice.payment_failed` |

Use any future expiry date, any CVC and any postal code.

- [ ] **J1 — Pricing/paywall.** The owner sees monthly, yearly and founding lifetime plans with correct prices and trial copy. A member sees the household's entitlement but cannot start checkout.
- [ ] **J2 — Owner checkout (monthly).** Owner starts monthly checkout, pays with the success card, returns to the app via the success URL. Entitlement becomes active and the plan is shown correctly.
- [ ] **J3 — Owner checkout (yearly).** Same for yearly. The correct price/plan is recorded.
- [ ] **J4 — Lifetime.** One-time lifetime purchase succeeds; no recurring subscription is created; the household is entitled.
- [ ] **J5 — Cancel at Checkout.** Return via the cancel URL. No entitlement change; a clear "checkout cancelled" message.
- [ ] **J6 — Declined card.** Decline card shows a friendly failure; no entitlement; the owner can retry.
- [ ] **J7 — 3D Secure.** 3DS challenge completes; entitlement is applied after the webhook.
- [ ] **J8 — Promotion code.** If enabled, a valid code applies the discount; an invalid code shows a clear error.
- [ ] **J9 — 14-day trial.** A new subscription starts `trialing`; entitlement is active during the trial; the trial end is visible to the owner.
- [ ] **J10 — Webhook signature.** Send an event with an invalid signature (or use a wrong `STRIPE_WEBHOOK_SECRET`). The function rejects it and writes nothing.
- [ ] **J11 — Webhook idempotency.** Replay a real event with `stripe events resend <event_id>`. No duplicate subscription/entitlement row; state remains correct.
- [ ] **J12 — Household-wide entitlement.** After A pays, B (member) sees premium access without paying. B cannot open the billing portal.
- [ ] **J13 — Customer Portal.** Owner opens the portal, updates a payment method, views invoices and cancels. Cancellation sets `cancel_at_period_end`; access continues until period end.
- [ ] **J14 — Payment failure.** Simulate `invoice.payment_failed` (for example with the `4000 0000 0000 0341` card and a test clock). The subscription status/entitlement behaviour matches the documented policy; the owner sees a clear message.
- [ ] **J15 — Subscription deleted.** After cancellation takes effect, entitlement is removed and premium actions are blocked.
- [ ] **J16 — Non-owner denial.** A member calling the checkout/portal function directly (not just via hidden UI) is rejected server-side.
- [ ] **J17 — Secret exposure.** `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` are absent from the client bundle and repository. Search the built output and `git grep` for `sk_test`, `sk_live` and `whsec_`.
- [ ] **J18 — Live-mode safety.** No live keys, live prices or live webhook endpoint are used during QA.

---

## 11. RLS and authorization negative cases

Run these against the **dev** project. The SQL editor runs as a privileged role by default, so switch to `authenticated` and set the JWT claims for the user you are simulating. Replace the UUID placeholders.

```sql
-- Simulate User B (a member of a different household) in a transaction.
begin;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '<USER_B_UUID>', 'role', 'authenticated')::text,
  true
);

-- Expect 0 rows: B must not read A's household, dogs, events or weights.
select count(*) from "Household"  where id = '<HOUSEHOLD_A_UUID>';
select count(*) from "Dogs"       where "householdId" = '<HOUSEHOLD_A_UUID>';
select count(*) from "DogEvent"   where "dogId" = '<DOG_A_UUID>';
select count(*) from "WeightLog"  where "dogId" = '<DOG_A_UUID>';

-- Expect an RLS/constraint error: B must not write into A's household.
insert into "DogEvent" (id, "dogId", type, "userId")
values (gen_random_uuid(), '<DOG_A_UUID>', 'feed', '<USER_B_UUID>');

rollback;
```

- [ ] **K1 — Unauthenticated access.** Requests without a user token cannot read or write domain tables (no rows, 401/403, or RLS denial).
- [ ] **K2 — Cross-household reads.** B cannot read A's `Household`, `HouseholdMember`, `Dogs`, `DogEvent` or `WeightLog` rows.
- [ ] **K3 — Cross-household writes.** B cannot insert, update or delete A's dogs, events or weights.
- [ ] **K4 — No self-promotion.** B cannot insert themselves into `HouseholdMember` as `owner`, and cannot change their role/status directly. Joining must go through the invite-code RPC.
- [ ] **K5 — Join requires a valid code.** A direct join without a valid invite code is rejected; household data is not exposed before joining.
- [ ] **K6 — One household per user.** A second active membership/creation is rejected by the database, not only by the UI.
- [ ] **K7 — Billing isolation.** B cannot read A's `BillingCustomer`, `Subscription` or `StripeEvent` rows, and no client role can insert/update/delete billing tables.
- [ ] **K8 — Service role isolation.** The `service_role` key is used only inside Edge Functions. It is not in the client bundle, `.env`, Vercel env or the repository.
- [ ] **K9 — Storage writes.** B cannot upload, overwrite or delete objects under A's household path. File type/size limits are enforced.
- [ ] **K10 — Storage reads.** Read access matches the documented policy; if the bucket is public, confirm that is intentional and that object paths do not expose private data.
- [ ] **K11 — RPC authorization.** `create_household`, `join_household`, `leave_household`, `remove_household_member`, `rename_household` and `regenerate_invite_code` check `auth.uid()` and ownership; non-owners cannot call owner-only RPCs.
- [ ] **K12 — SQL test rollback.** The negative-case transaction is rolled back; no test rows remain.

---

## 12. iOS, Android, desktop and accessibility

| Surface | What to cover |
| --- | --- |
| iOS Safari (browser) | Sign-up/in, join, log, backdate, CSV share/download, Stripe checkout/3DS, offline shell, keyboard and safe areas. |
| iOS installed PWA | Install, launch, auth persistence, logging, offline state, update after deploy. |
| Android Chrome (browser + installed PWA) | Same as iOS, plus Android back behaviour and install prompt. |
| Desktop Chrome | Full two-user flow, realtime across windows, CSV download, Stripe portal, keyboard-only. |
| Desktop Safari | Auth, logging, CSV, Stripe checkout (including 3DS), layout. |
| Desktop Firefox | Auth, logging, CSV, layout, realtime. |
| Responsive sizes | 320 px, 390 px, 768 px, 1440 px — no horizontal scroll or clipped controls. |

Accessibility and UX:

- [ ] **L1 — Keyboard only.** Every flow can be completed without a mouse: sign-in, setup, logging, editing, dialogs, CSV, billing.
- [ ] **L2 — Modal semantics.** Dialogs trap focus, close on Escape, return focus to the trigger, and are announced with a role/name.
- [ ] **L3 — Labels and errors.** Inputs have associated labels; validation errors are announced and connected to the field.
- [ ] **L4 — Images and icons.** Dog photos have alt text; icon-only buttons have accessible names.
- [ ] **L5 — Contrast.** Body text meets WCAG AA; muted text and disabled states are still legible.
- [ ] **L6 — Toasts/live regions.** Success and error toasts use an appropriate live region and are not the only signal of failure.
- [ ] **L7 — Screen reader smoke test.** VoiceOver (iOS) or TalkBack (Android) can identify the main controls and complete a log.
- [ ] **L8 — Console cleanliness.** No uncaught exceptions, React key warnings or failed requests on the happy paths.

---

## 13. Known Release 1 limitations (not bugs)

Do not file these as defects for v0.1.0:

- No push notifications or automated reminders.
- No offline write queue/background sync; offline writes must fail visibly.
- No multi-household switching; one active household per user.
- No native apps or app-store billing.
- No weight charts/advanced analytics.
- No sitter/walker portal or ML predictions.

---

## 14. Sign-off

| Area | Result | Notes / issue links | Tester | Date |
| --- | --- | --- | --- | --- |
| Auth and password recovery | | | | |
| Onboarding and household creation | | | | |
| Household join/roles/membership | | | | |
| Care logging | | | | |
| Backdate and edit | | | | |
| Realtime | | | | |
| Weight | | | | |
| CSV export | | | | |
| Offline/PWA | | | | |
| Stripe test mode | | | | |
| RLS negative cases | | | | |
| iOS/Android/desktop | | | | |
| Accessibility | | | | |

Release decision:

- [ ] Zero open P0/P1 issues.
- [ ] Two real browser profiles complete the household flow.
- [ ] Stripe test-mode checkout, webhook, portal, cancellation and lifetime all pass.
- [ ] RLS negative cases all pass.
- [ ] Rollback runbook ([docs/deploy.md](deploy.md)) has been read and is understood by the release owner.
- [ ] Release owner sign-off: ______________________  Date: __________
