// Date helpers — ALWAYS use the device's LOCAL calendar day for habit
// check-ins, streaks and monthly rollups.
//
// Why this exists (bug #16 — "individual task progress is not being saved
// day-to-day"): the app previously derived "today" from
// `new Date().toISOString().split('T')[0]`, which is the **UTC** date. For a
// user in a US timezone (UTC-5…-8), an evening check-in (the most common time
// to log habits) falls on the *next* UTC calendar day. The result: check-ins
// land on the wrong day, the next morning's checklist looks pre-filled or
// empty, and the streak calculation skips a day — so progress appears to be
// lost between days. Using the local calendar day everywhere makes a check-in
// belong to the day the user actually lived.

/** Device-local calendar date as `YYYY-MM-DD` (NOT UTC). */
export function localDateString(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** First day of `d`'s local month as `YYYY-MM-DD`. */
export function localMonthStart(d: Date = new Date()): string {
  return localDateString(new Date(d.getFullYear(), d.getMonth(), 1));
}

/** Parse a `YYYY-MM-DD` string into a LOCAL Date (midnight local, not UTC). */
export function parseLocalDate(ds: string): Date {
  const [y, m, d] = ds.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Add `n` days (may be negative) to a `YYYY-MM-DD` string, returning `YYYY-MM-DD`. */
export function addLocalDays(ds: string, n: number): string {
  const d = parseLocalDate(ds);
  d.setDate(d.getDate() + n);
  return localDateString(d);
}

/**
 * Human label for a `YYYY-MM-DD` day relative to today:
 * "Today", "Yesterday", or e.g. "Sat, Jun 28" (bug #20 — previous-day editing).
 */
export function formatDayLabel(ds: string): string {
  const today = localDateString();
  if (ds === today) return 'Today';
  if (ds === addLocalDays(today, -1)) return 'Yesterday';
  return parseLocalDate(ds).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}
