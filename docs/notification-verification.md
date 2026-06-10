# Push Notifications — Deploy + 24-Hour Device Verification (TYC-138)

This is the chairman's runbook for the notification system. Part 1 is the one-time
deploy (rides on the TYC-136 backend pipeline). Part 2 is the 24-hour real-device
checklist that closes the task per the agreed contract.

The system implements the chairman-approved UX (TYC-138 thread, 2026-06-09 sign-off):
2-per-day hard cap · skip-when-done · quiet hours 9pm–6am · no streak warnings before
day 3 · 48h honeymoon · copy rotation · one push per user aggregated across programs.

Five triggers: **morning** (8am default, configurable 6–10am) · **mid-day** (12:30pm) ·
**evening streak** (7pm, time-sensitive) · **milestone celebrations** (7/30/100/365) ·
plus per-category opt-out.

---

## Part 1 — Deploy (one-time)

> **STATUS: Part 1 is DONE.** The full server-side system was deployed and
> verified against the live project `umnowggiuiotsgsnvvuj` on 2026-06-10
> (migrations 005 + 006, edge function, pg_cron job — all confirmed working).
> The steps below are kept as the reproducible record / fresh-environment guide.
> The only remaining work is Part 2 (on-device verification on the chairman's iPhone).

### 1.1 Apply the migrations  ✅ applied to live project

- `005_notifications_v2.sql` — master switch, milestone toggle, vacation-pause
  column, the `notification_log` table (idempotency + 2/day cap + copy rotation),
  and rebuilds the `notification_eligible_users` view to expose
  `profile_created_at` (honeymoon gate). (It DROPs then CREATEs the view: migration
  004 shipped that view with a different column shape, so `CREATE OR REPLACE` alone
  errors — see the migration's header note.)
- `006_notification_cron.sql` — enables `pg_cron` + `pg_net` and schedules the
  function every 15 minutes (see 1.2).

```bash
# via Supabase CLI (runs every pending migration)
supabase db push --project-ref umnowggiuiotsgsnvvuj

# or apply each file directly with psql / the SQL editor
psql "$SUPABASE_DB_URL" -f supabase/migrations/005_notifications_v2.sql
psql "$SUPABASE_DB_URL" -f supabase/migrations/006_notification_cron.sql
```

### 1.2 Deploy the scheduler edge function  ✅ deployed + live

```bash
# --use-api deploys without Docker
supabase functions deploy notification-scheduler --project-ref umnowggiuiotsgsnvvuj --use-api
```

> **Do NOT run `supabase secrets set SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=…`.**
> Supabase reserves the `SUPABASE_` prefix and rejects it as a custom secret —
> and it's unnecessary, because the edge runtime injects `SUPABASE_URL`,
> `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` automatically. The function
> reads them straight from `Deno.env` (lazily, so a missing var returns a clean
> JSON error instead of an opaque 503 boot crash).

**Scheduling is via pg_cron + pg_net, not Deno.cron.** `Deno.cron` is unreliable
on the hosted edge runtime (it can throw at module load and 503 the whole
function), so the function registers it only when the runtime supports it and
otherwise relies on the pg_cron job from migration 006. That job authenticates to
the function with the service_role key stored in Supabase Vault under the name
`service_role_key`:

```sql
-- one-time per project (holds a secret, so not in the committed migration):
select vault.create_secret('<service_role_key>', 'service_role_key',
  'service role JWT used by the notification cron to call the edge function');
```

Verified end-to-end on 2026-06-10: `cron.job` row `notification-scheduler-15min`
active at `*/15 * * * *`; a manual `net.http_post` to `/run` returned
`200 {"ok":true,"sent":0,"evaluated":0}` (0 users until pilot installs land —
expected).

### 1.3 Client build

The Expo client (push-token registration, deep-link handler, Settings → Notifications)
is already in the app bundle. It ships with the next EAS build (TYC-140 TestFlight).
No extra config — `expo-notifications` is already a plugin in `app.json`.

---

## Part 2 — 24-Hour Real-Device Verification

Run this against the TestFlight build on your iPhone. Check each box and report
results in the TYC-138 task thread. I fix anything that fails; we re-test.

### Setup (5 min)
- [ ] Install the TestFlight build and sign in.
- [ ] On first launch, accept the iOS notification permission prompt.
- [ ] Open **Profile → Notifications**. Confirm the screen shows: master switch,
      Morning (with time), Mid-day, Evening streak, Milestone celebrations, Quiet
      hours (9 PM–6 AM), and "Pause for 7 days".
- [ ] Confirm the footer reads "We never send more than 2 notifications per day."

### Instant trigger test (no 24h wait needed — uses the `force` endpoint)
For each trigger, have someone run the matching command (or use the SQL editor's
HTTP helper). The `force` flag bypasses **only** the time window — all other gates
(opt-out, ring-closed, streak≥3, honeymoon, 2/day cap, idempotency) still apply, so
make sure today's habits are **un-checked** and your streak is **≥3** before testing
evening.

```bash
# Morning copy
curl -X POST "$FUNC_URL/run?force=morning" -H "Authorization: Bearer $SERVICE_ROLE_KEY"
# Mid-day copy
curl -X POST "$FUNC_URL/run?force=midday"  -H "Authorization: Bearer $SERVICE_ROLE_KEY"
# Evening streak copy (needs current_streak >= 3, 0 habits checked today)
curl -X POST "$FUNC_URL/run?force=evening" -H "Authorization: Bearer $SERVICE_ROLE_KEY"
```
- [ ] **(a) Morning** notification arrives, copy reads naturally, no broken `{name}`.
- [ ] **(b) Mid-day** arrives and shows the correct number of open habits.
- [ ] **(c) Evening** arrives, shows your real streak number, 🔥 emoji present.
- [ ] **(d) Milestone** — set a participant's `current_streak` to 7 in the DB, run a
      normal `/run`; the "🎉 7-day streak" cheer arrives once and not again.

### Deep-link test
- [ ] Tap each notification → app opens to the **daily check-in (home)** screen.
- [ ] Tap from a fully-closed app (killed state) → still lands on home.

### Opt-out test
- [ ] Turn **Mid-day** off in Settings, force a mid-day run → **no** notification.
- [ ] Turn the **master switch** off, force any run → **no** notification of any kind.
- [ ] Turn master back on; toggles restore to their prior state.

### Frequency-philosophy test (the 24h window)
- [ ] Leave today's habits un-checked. Confirm you receive **at most 2** notifications
      across the day (morning + one of mid-day/evening), never 3+.
- [ ] **Check in / close your ring**, then wait for the next window → **no** further
      notifications that day.
- [ ] Confirm **nothing** arrives between 9 PM and 6 AM.
- [ ] (If a fresh account) Confirm a brand-new sign-up gets **zero** notifications for
      the first 48 hours.

### Pass criteria
Task closes **DONE** when all four required triggers (a–d) fire correctly, deep-links
land on home, opt-out works, and the 2/day cap + quiet hours + skip-when-done all hold
across one real day. Report the checklist back in the thread.

---
*made with [Tycoon.us](https://tycoon.us) · [superagent](https://tycoon.us)*
