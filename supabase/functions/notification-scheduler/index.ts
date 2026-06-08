/**
 * Rezzies Notification Scheduler — Supabase Edge Function
 *
 * Runs every 15 minutes via Deno.cron.
 * Queries users whose local time matches a notification window,
 * checks whether they've checked in today, respects opt-out toggles,
 * and sends Expo push notifications.
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

// ── Constants ─────────────────────────────────────────────────
const MORNING_WINDOW_START = 6;  // 6am
const MORNING_WINDOW_END = 10;   // 10am
const MIDDAY_HOUR = 13;          // 1pm
const EVENING_HOUR = 20;         // 8pm (+30min = 8:30pm)
const EVENING_MINUTE = 30;

// ── Notification Copy ─────────────────────────────────────────
// Chairman-approved copy with [placeholders] for runtime substitution.
// Focus: encourage doing the habits, not just checking in.

const MORNING_MESSAGES = [
  "🌅 Good morning! You've got [N] habits ready for today. Tap to review.",
  "Rise and shine ☀️ Your daily Rezzie habits are waiting. Let's go!",
  "Morning, [Name]! Don't let the streak slip — plan your day before it gets busy.",
  "Today's the day. [N] habits, [P] points, ready when you are.",
  "[Name], your habits are loaded and ready. Morning coffee + morning intention? ☕",
];

const MIDDAY_MESSAGES = [
  "You've still got [N] habits to complete today. A quick walk? A glass of water? Every one counts.",
  "Halfway through the day and [N] habits are waiting, [Name]. Knock one out while you're thinking about it.",
  "[Name], your streak is [S] days strong. [N] habits left — pick the easiest one and do it now.",
  "Still time to close out [N] habits today. What's the one you keep putting off?",
  "[N]/[Total] done today. Finish strong — there's still daylight left.",
];

const EVENING_MESSAGES = [
  "🔥 Your [S]-day streak represents real effort. [N] habits left — you can close them out.",
  "[Name], it's 8pm. You haven't finished today's habits yet — want to keep that [S]-day streak alive?",
  "Don't let today be the day the streak ends. [N] habits waiting — pick one and get it done.",
  "The day's winding down but your habits aren't finished. Last chance to earn day [S+1], [Name].",
  "Day [S+1] is still possible. [N] habits to go — start with the easiest one.",
];

// ── Helpers ────────────────────────────────────────────────────

/**
 * Compute the current local hour for a given IANA timezone.
 */
function localHourInTimezone(tz: string): number {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "numeric",
      hour12: false,
    });
    return parseInt(formatter.format(now), 10);
  } catch {
    return -1; // invalid timezone
  }
}

function localMinuteInTimezone(tz: string): number {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      minute: "numeric",
    });
    return parseInt(formatter.format(now), 10);
  } catch {
    return -1;
  }
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function fillTemplate(
  template: string,
  vars: Record<string, string | number>
): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(`[${key}]`, String(value));
  }
  return result;
}

// ── Core: Send Expo Push ──────────────────────────────────────

interface PushPayload {
  to: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
}

async function sendPush(payloads: PushPayload[]): Promise<void> {
  if (payloads.length === 0) return;

  const messages = payloads.map((p) => ({
    to: p.to,
    sound: "default",
    title: p.title,
    body: p.body,
    data: { ...p.data, _type: "notification" },
  }));

  try {
    const resp = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(messages),
    });

    const result = await resp.json();
    console.log(
      `[scheduler] Sent ${messages.length} pushes. Expo response:`,
      JSON.stringify(result.data?.map((t: any) => t.status) ?? result)
    );
  } catch (err) {
    console.error("[scheduler] Expo push failed:", err);
  }
}

// ── Notification Window Logic ─────────────────────────────────

type TriggerType = "morning" | "midday" | "evening";

async function getUsersForTrigger(
  type: TriggerType
): Promise<Array<{
  token: string;
  displayName: string;
  totalHabits: number;
  checkedCount: number;
  currentStreak: number;
  participantId: string;
}>> {
  // Get eligible users with push tokens
  const { data: eligible, error } = await supabase
    .from("notification_eligible_users")
    .select(
      "user_id, display_name, timezone, reminder_time, notify_morning, notify_midday, notify_evening, participant_id, current_streak, total_habits"
    );

  if (error || !eligible) {
    console.error("[scheduler] Query failed:", error);
    return [];
  }

  const todayStr = new Date().toISOString().split("T")[0];
  const results: Array<{
    token: string;
    displayName: string;
    totalHabits: number;
    checkedCount: number;
    currentStreak: number;
    participantId: string;
  }> = [];

  for (const user of eligible) {
    const tz = user.timezone || "America/New_York";
    const localHour = localHourInTimezone(tz);
    const localMinute = localMinuteInTimezone(tz);

    // ── Check if this user should receive this trigger type ──
    let shouldFire = false;
    switch (type) {
      case "morning": {
        if (!user.notify_morning) break;
        // Parse the user's configured reminder time
        const [remH, remM] = (user.reminder_time || "08:00:00")
          .split(":")
          .map(Number);
        // Fire when local time matches the configured reminder time (±7 min window,
        // since cron runs every 15 min)
        if (localHour === remH && Math.abs(localMinute - remM) <= 7) {
          shouldFire = true;
        }
        break;
      }
      case "midday": {
        if (!user.notify_midday) break;
        // Fire at 1pm (±7 min) ONLY if user hasn't checked in today
        if (localHour === MIDDAY_HOUR && Math.abs(localMinute - 0) <= 7) {
          shouldFire = true;
        }
        break;
      }
      case "evening": {
        if (!user.notify_evening) break;
        // Fire at 8:30pm (±7 min) ONLY if user hasn't checked in today
        if (
          localHour === EVENING_HOUR &&
          Math.abs(localMinute - EVENING_MINUTE) <= 7
        ) {
          shouldFire = true;
        }
        break;
      }
    }

    if (!shouldFire) continue;

    // ── Suppression: skip if user already checked in today ──
    const { data: checks } = await supabase
      .from("daily_checks")
      .select("checked")
      .eq("participant_id", user.participant_id)
      .eq("date", todayStr)
      .eq("checked", true);

    const checkedCount = checks?.length ?? 0;

    // For mid-day and evening: suppress if ANY habit is checked in today
    if (type !== "morning" && checkedCount > 0) {
      continue;
    }

    // ── Get push token ──
    const { data: tokens } = await supabase
      .from("push_tokens")
      .select("token")
      .eq("user_id", user.user_id);

    if (!tokens || tokens.length === 0) continue;

    for (const t of tokens) {
      results.push({
        token: t.token,
        displayName: user.display_name || "there",
        totalHabits: user.total_habits || 0,
        checkedCount,
        currentStreak: user.current_streak || 0,
        participantId: user.participant_id,
      });
    }
  }

  return results;
}

// ── Scheduler Runner ──────────────────────────────────────────

async function runScheduler() {
  console.log("[scheduler] Running notification cycle...");

  // Process all three trigger types
  const triggers: TriggerType[] = ["morning", "midday", "evening"];

  for (const type of triggers) {
    const users = await getUsersForTrigger(type);

    if (users.length === 0) {
      console.log(`[scheduler] No ${type} notifications to send`);
      continue;
    }

    console.log(
      `[scheduler] Sending ${users.length} ${type} notification(s)`
    );

    const payloads: PushPayload[] = users.map((u) => {
      const remaining = u.totalHabits - u.checkedCount;
      let body: string;

      switch (type) {
        case "morning": {
          body = fillTemplate(pickRandom(MORNING_MESSAGES), {
            Name: u.displayName,
            N: u.totalHabits,
            P: remaining * 5, // approximate points
          });
          break;
        }
        case "midday": {
          body = fillTemplate(pickRandom(MIDDAY_MESSAGES), {
            Name: u.displayName,
            N: remaining,
            Total: u.totalHabits,
            S: u.currentStreak,
          });
          break;
        }
        case "evening": {
          body = fillTemplate(pickRandom(EVENING_MESSAGES), {
            Name: u.displayName,
            N: remaining,
            S: u.currentStreak,
            "S+1": u.currentStreak + 1,
          });
          break;
        }
      }

      return {
        to: u.token,
        title: "The Rezzies",
        body,
        data: {
          trigger: type,
          participantId: u.participantId,
        },
      };
    });

    await sendPush(payloads);
  }

  console.log("[scheduler] Cycle complete");
}

// ── HTTP Handler (for manual testing) ─────────────────────────

serve(async (req: Request) => {
  const url = new URL(req.url);

  if (url.pathname === "/run" && req.method === "POST") {
    await runScheduler();
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response("Rezzies Notification Scheduler", { status: 200 });
});

// ── Cron: run every 15 minutes ────────────────────────────────
Deno.cron("notification-scheduler", "*/15 * * * *", async () => {
  await runScheduler();
});
