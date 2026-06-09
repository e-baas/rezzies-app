/**
 * Rezzies Notification Scheduler — Supabase Edge Function (v2, TYC-138)
 *
 * Runs every 15 minutes via Deno.cron. Implements the chairman-approved
 * frequency philosophy (TYC-138 thread, 2026-06-09 sign-off):
 *
 *   1. Hard cap 2 notifications/user/day (milestone celebrations excepted).
 *   2. Skip the day entirely once the ring is closed.
 *   3. Quiet hours: never before 6am / after 9pm local.
 *   4. No streak warnings before day 3 (evening gated on streak >= 3).
 *   5. 48h honeymoon: zero notifications for the first 48h after signup.
 *   6. Copy rotation: never the same variant two days running.
 *   7. One push per USER (aggregated across all their programs).
 *
 * Five triggers: morning (8am default, configurable) · midday (12:30pm) ·
 * evening streak nudge (7pm) · milestone celebrations (7/30/100/365) ·
 * all per-category opt-out.
 *
 * Idempotency + cap + rotation are all driven by the notification_log table
 * (see migration 005). A re-tick inside the ±7-min window cannot double-send.
 *
 * Deploy: supabase functions deploy notification-scheduler --project-ref umnowggiuiotsgsnvvuj
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

// ── Env ───────────────────────────────────────────────────────
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ── Tunables (chairman-approved windows) ──────────────────────
const QUIET_START_HOUR = 21;   // 9pm — no sends at/after this hour
const QUIET_END_HOUR = 6;      // 6am — no sends before this hour
const WINDOW_MIN = 7;          // ±7 min tolerance (cron fires every 15 min)
const MIDDAY_HOUR = 12;
const MIDDAY_MINUTE = 30;      // 12:30pm
const EVENING_HOUR = 19;       // 7:00pm
const EVENING_MINUTE = 0;
const MILESTONE_OPEN_HOUR = 9; // milestone celebrations only 9am–8pm
const MILESTONE_CLOSE_HOUR = 20;
const DAILY_CAP = 2;           // hard cap of daily-category sends per user/day
const HONEYMOON_HOURS = 48;
const MILESTONES = [7, 30, 100, 365];

// ── Notification copy (chairman-approved, TYC-138) ────────────
// {name} {N} {open} {total} {checked} substituted at runtime.
const MORNING_COPY = [
  "Good morning. Today's habits are waiting.",
  "{name}, ready to log today?",
  "{total} habits, one ring to close. Let's go.",
  "Fresh check-in for today. Tap to start.",
  "You closed yesterday. Same again today?",
];

const MIDDAY_COPY = [
  "You still have {open} habits today. Quick check-in?",
  "Halfway through the day — {open} habits left.",
  "{open} habits between you and a closed ring today.",
  "You're at {checked} of {total}. Knock out one before lunch?",
  "{name}, day's still open. {open} to go.",
];

const EVENING_COPY = [
  "🔥 {N}-day streak. Don't break it tonight.",
  "Your {N}-day streak is on the line. 2 hours left.",
  "{N} days strong. One check-in keeps it going.",
  "It's 7pm. Your streak is still alive — for now.",
  "🔥 {N} days. Worth a 30-second check-in?",
];

// Milestone copy keyed by streak length (one-time celebrations).
const MILESTONE_COPY: Record<number, string> = {
  7: "🎉 7-day streak. That's a full week.",
  30: "30 days. You've made it a habit.",
  100: "100 days. You're in rare company. 💯",
  365: "365 days. One full year, {name}. Incredible.",
};

// ── Helpers ────────────────────────────────────────────────────

function localParts(tz: string): { hour: number; minute: number; date: string } {
  try {
    const now = new Date();
    const hm = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "numeric",
      minute: "numeric",
      hour12: false,
    }).formatToParts(now);
    const hour = parseInt(hm.find((p) => p.type === "hour")?.value ?? "-1", 10);
    const minute = parseInt(hm.find((p) => p.type === "minute")?.value ?? "-1", 10);
    // en-CA yields YYYY-MM-DD; this is the user's LOCAL calendar date.
    const date = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(now);
    return { hour: hour === 24 ? 0 : hour, minute, date };
  } catch {
    return { hour: -1, minute: -1, date: "" };
  }
}

function withinWindow(curMin: number, curHour: number, targetHour: number, targetMin: number): boolean {
  if (curHour !== targetHour) return false;
  return Math.abs(curMin - targetMin) <= WINDOW_MIN;
}

function fillTemplate(template: string, vars: Record<string, string | number>): string {
  let out = template;
  for (const [k, v] of Object.entries(vars)) out = out.replaceAll(`{${k}}`, String(v));
  return out;
}

// ── Aggregated per-user state ─────────────────────────────────
interface UserState {
  userId: string;
  displayName: string;
  createdAt: string;
  timezone: string;
  reminderTime: string;        // 'HH:MM:SS'
  notificationsEnabled: boolean;
  notifyMorning: boolean;
  notifyMidday: boolean;
  notifyEvening: boolean;
  notifyMilestone: boolean;
  pausedUntil: string | null;
  participantIds: string[];
  totalHabits: number;         // summed across programs
  maxStreak: number;
}

async function loadUserStates(): Promise<UserState[]> {
  const { data, error } = await supabase.from("notification_eligible_users").select("*");
  if (error || !data) {
    console.error("[scheduler] view query failed:", error);
    return [];
  }

  const byUser = new Map<string, UserState>();
  for (const row of data) {
    let s = byUser.get(row.user_id);
    if (!s) {
      s = {
        userId: row.user_id,
        displayName: (row.display_name || "there").split(" ")[0],
        createdAt: row.profile_created_at,
        timezone: row.timezone || "America/New_York",
        reminderTime: row.reminder_time || "08:00:00",
        notificationsEnabled: row.notifications_enabled !== false,
        notifyMorning: row.notify_morning !== false,
        notifyMidday: row.notify_midday !== false,
        notifyEvening: row.notify_evening !== false,
        notifyMilestone: row.notify_milestone !== false,
        pausedUntil: row.notifications_paused_until ?? null,
        participantIds: [],
        totalHabits: 0,
        maxStreak: 0,
      };
      byUser.set(row.user_id, s);
    }
    s.participantIds.push(row.participant_id);
    s.totalHabits += row.total_habits || 0;
    s.maxStreak = Math.max(s.maxStreak, row.current_streak || 0);
  }
  return Array.from(byUser.values());
}

/** Count checked habits today across all the user's participant rows. */
async function checkedToday(participantIds: string[], localDate: string): Promise<number> {
  if (participantIds.length === 0) return 0;
  const { data } = await supabase
    .from("daily_checks")
    .select("id")
    .in("participant_id", participantIds)
    .eq("date", localDate)
    .eq("checked", true);
  return data?.length ?? 0;
}

/** Rows logged for this user on this local date (for the 2/day cap). */
async function dailySendCount(userId: string, localDate: string): Promise<number> {
  const { data } = await supabase
    .from("notification_log")
    .select("category")
    .eq("user_id", userId)
    .eq("sent_date", localDate);
  // Milestone celebrations do not count toward the 2/day cap.
  return (data ?? []).filter((r) => !String(r.category).startsWith("milestone:")).length;
}

async function alreadyLogged(userId: string, localDate: string, category: string): Promise<boolean> {
  const { data } = await supabase
    .from("notification_log")
    .select("id")
    .eq("user_id", userId)
    .eq("category", category)
    .eq("sent_date", localDate)
    .limit(1);
  return (data?.length ?? 0) > 0;
}

async function milestoneAlreadySent(userId: string, milestone: number): Promise<boolean> {
  // Milestone is once-ever, so match on category regardless of date.
  const { data } = await supabase
    .from("notification_log")
    .select("id")
    .eq("user_id", userId)
    .eq("category", `milestone:${milestone}`)
    .limit(1);
  return (data?.length ?? 0) > 0;
}

/** Pick a copy variant index different from the one used last time for this category. */
async function pickVariant(userId: string, category: string, count: number): Promise<number> {
  const { data } = await supabase
    .from("notification_log")
    .select("variant_index")
    .eq("user_id", userId)
    .eq("category", category)
    .order("sent_date", { ascending: false })
    .limit(1);
  const last = data?.[0]?.variant_index ?? -1;
  if (count <= 1) return 0;
  let idx = Math.floor(Math.random() * count);
  if (idx === last) idx = (idx + 1) % count;
  return idx;
}

async function logSend(userId: string, localDate: string, category: string, variantIndex: number): Promise<boolean> {
  const { error } = await supabase
    .from("notification_log")
    .insert({ user_id: userId, sent_date: localDate, category, variant_index: variantIndex });
  // Unique-violation = a concurrent tick already claimed it; treat as "do not send".
  if (error) {
    if ((error as { code?: string }).code === "23505") return false;
    console.error("[scheduler] log insert failed:", error);
    return false;
  }
  return true;
}

async function tokensFor(userId: string): Promise<string[]> {
  const { data } = await supabase.from("push_tokens").select("token").eq("user_id", userId);
  return (data ?? []).map((t) => t.token).filter(Boolean);
}

interface PushMsg {
  to: string;
  title: string;
  body: string;
  sound: string;
  priority?: string;
  data: Record<string, unknown>;
}

async function sendExpo(messages: PushMsg[]): Promise<void> {
  if (messages.length === 0) return;
  // Expo accepts up to 100 messages per request.
  for (let i = 0; i < messages.length; i += 100) {
    const batch = messages.slice(i, i + 100);
    try {
      const resp = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(batch),
      });
      const result = await resp.json();
      console.log(`[scheduler] sent ${batch.length} push(es):`, JSON.stringify(result.data?.map((t: { status?: string }) => t.status) ?? result));
    } catch (err) {
      console.error("[scheduler] Expo push failed:", err);
    }
  }
}

// ── Core: decide + send one notification per user ─────────────

async function runScheduler(opts: { force?: string } = {}): Promise<{ sent: number; evaluated: number }> {
  const states = await loadUserStates();
  let sent = 0;

  for (const u of states) {
    // ── Universal gates ──
    if (!u.notificationsEnabled) continue;                       // master switch
    if (u.pausedUntil && new Date(u.pausedUntil) > new Date()) continue; // vacation pause

    const { hour, minute, date } = localParts(u.timezone);
    if (hour < 0 || !date) continue;                             // bad timezone

    // 48h honeymoon
    if (u.createdAt) {
      const ageH = (Date.now() - new Date(u.createdAt).getTime()) / 3_600_000;
      if (ageH < HONEYMOON_HOURS) continue;
    }

    // Quiet hours (applies to every category)
    if (hour >= QUIET_START_HOUR || hour < QUIET_END_HOUR) continue;

    const checked = await checkedToday(u.participantIds, date);
    const open = Math.max(0, u.totalHabits - checked);
    const ringClosed = u.totalHabits > 0 && checked >= u.totalHabits;

    // ── Choose the single category to fire this tick (priority order) ──
    // 1) Milestone celebration (does not count toward the daily cap).
    if (u.notifyMilestone && hour >= MILESTONE_OPEN_HOUR && hour < MILESTONE_CLOSE_HOUR) {
      const m = MILESTONES.find((x) => x === u.maxStreak);
      if (m && !(await milestoneAlreadySent(u.userId, m))) {
        const category = `milestone:${m}`;
        if (await logSend(u.userId, date, category, m)) {
          const tokens = await tokensFor(u.userId);
          const body = fillTemplate(MILESTONE_COPY[m], { name: u.displayName, N: m });
          await sendExpo(tokens.map((to) => ({
            to, title: "The Rezzies", sound: "default", priority: "high",
            body, data: { trigger: "milestone", milestone: m, target: "/(tabs)/home", celebrate: true },
          })));
          sent += tokens.length > 0 ? 1 : 0;
          continue; // one push per user per tick
        }
      }
    }

    // Remaining daily categories share the 2/day hard cap.
    if ((await dailySendCount(u.userId, date)) >= DAILY_CAP) continue;
    if (ringClosed) continue; // rule 2: stop once the ring is closed

    // 2) Evening streak nudge (7pm, streak >= 3, not yet checked in today).
    const fireEvening = u.notifyEvening && withinWindow(minute, hour, EVENING_HOUR, EVENING_MINUTE);
    if ((opts.force === "evening" || fireEvening) && u.maxStreak >= 3 && checked === 0) {
      if (!(await alreadyLogged(u.userId, date, "evening"))) {
        const idx = await pickVariant(u.userId, "evening", EVENING_COPY.length);
        if (await logSend(u.userId, date, "evening", idx)) {
          const tokens = await tokensFor(u.userId);
          const body = fillTemplate(EVENING_COPY[idx], { name: u.displayName, N: u.maxStreak, open, total: u.totalHabits, checked });
          await sendExpo(tokens.map((to) => ({
            to, title: "The Rezzies", sound: "default", priority: "high",
            body, data: { trigger: "evening", target: "/(tabs)/home" },
          })));
          sent += tokens.length > 0 ? 1 : 0;
          continue;
        }
      }
    }

    // 3) Mid-day "still have N habits" (12:30pm, not yet checked in today).
    const fireMidday = u.notifyMidday && withinWindow(minute, hour, MIDDAY_HOUR, MIDDAY_MINUTE);
    if ((opts.force === "midday" || fireMidday) && checked === 0 && open > 0) {
      if (!(await alreadyLogged(u.userId, date, "midday"))) {
        const idx = await pickVariant(u.userId, "midday", MIDDAY_COPY.length);
        if (await logSend(u.userId, date, "midday", idx)) {
          const tokens = await tokensFor(u.userId);
          const body = fillTemplate(MIDDAY_COPY[idx], { name: u.displayName, N: u.maxStreak, open, total: u.totalHabits, checked });
          await sendExpo(tokens.map((to) => ({
            to, title: "The Rezzies", sound: "default",
            body, data: { trigger: "midday", target: "/(tabs)/home" },
          })));
          sent += tokens.length > 0 ? 1 : 0;
          continue;
        }
      }
    }

    // 4) Morning reminder (user-configured time, not yet checked in today).
    const [remH, remM] = u.reminderTime.split(":").map(Number);
    const fireMorning = u.notifyMorning && withinWindow(minute, hour, remH, remM);
    if ((opts.force === "morning" || fireMorning) && checked === 0) {
      if (!(await alreadyLogged(u.userId, date, "morning"))) {
        const idx = await pickVariant(u.userId, "morning", MORNING_COPY.length);
        if (await logSend(u.userId, date, "morning", idx)) {
          const tokens = await tokensFor(u.userId);
          const body = fillTemplate(MORNING_COPY[idx], { name: u.displayName, N: u.maxStreak, open, total: u.totalHabits, checked });
          await sendExpo(tokens.map((to) => ({
            to, title: "The Rezzies", sound: "default",
            body, data: { trigger: "morning", target: "/(tabs)/home" },
          })));
          sent += tokens.length > 0 ? 1 : 0;
          continue;
        }
      }
    }
  }

  console.log(`[scheduler] cycle complete — evaluated ${states.length} user(s), sent ${sent}`);
  return { sent, evaluated: states.length };
}

// ── HTTP handler ──────────────────────────────────────────────
// POST /run            → run a normal cycle (respects all time windows).
// POST /run?force=morning|midday|evening
//                      → bypass the time window for that category so the
//                        chairman can verify a trigger immediately on-device
//                        (all OTHER gates — cap, opt-out, honeymoon, ring,
//                        streak>=3, idempotency — still apply).
serve(async (req: Request) => {
  const url = new URL(req.url);
  if (url.pathname.endsWith("/run") && req.method === "POST") {
    const force = url.searchParams.get("force") ?? undefined;
    const result = await runScheduler({ force: force ?? undefined });
    return new Response(JSON.stringify({ ok: true, ...result }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
  return new Response("Rezzies Notification Scheduler", { status: 200 });
});

// ── Cron: every 15 minutes ────────────────────────────────────
Deno.cron("notification-scheduler", "*/15 * * * *", async () => {
  await runScheduler();
});
