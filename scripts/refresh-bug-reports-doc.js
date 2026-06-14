#!/usr/bin/env node
/**
 * Refresh the "Bug Reports — Dev Review" Doc.
 *
 * Reads bug_reports, assigns a stable sequential bug number (oldest = #1),
 * builds a lifecycle status summary + a priority-sorted table of the latest 50
 * reports, and PATCHes the Doc body via the tyny agent API.
 *
 * Env required:
 *   SUPABASE_DB_URL        — postgres connection string (uses pg pooler or direct)
 *   TYCTL_BASE_URL         — tyny base URL (e.g. https://app.tyny.dev)
 *   TYCTL_AUTH_TOKEN       — pod bearer token
 *   BUG_REPORTS_DOC_ID     — Doc.id to update
 *   FORCE_REFRESH=1        — write the Doc even when the table is empty
 *
 * Exit codes: 0 ok, 1 partial (some step failed but final write ok), 2 fatal.
 */
const { Client } = require('pg');

const REQUIRED = ['SUPABASE_DB_URL', 'TYCTL_BASE_URL', 'TYCTL_AUTH_TOKEN', 'BUG_REPORTS_DOC_ID'];
for (const k of REQUIRED) {
  if (!process.env[k]) {
    console.error(`Missing env: ${k}`);
    process.exit(2);
  }
}

function fmtDateTime(d) {
  if (!d) return '';
  return new Date(d).toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
}

function fmtDate(d) {
  if (!d) return '';
  return new Date(d).toISOString().slice(0, 10);
}

function severityEmoji(s) {
  return { low: '🙂', annoying: '😐', blocks: '😩' }[s] || s;
}

function sourceEmoji(s) {
  return { manual: '🐞', js_error: '⚠️', native_crash: '💥', unhandled_promise: '⛔' }[s] || s;
}

// Lifecycle status -> label + sort weight (active states bubble to the top).
const STATUS_META = {
  open:           { label: '🟡 open',           weight: 0 },
  triaged:        { label: '🟠 triaged',        weight: 1 },
  in_progress:    { label: '🔵 in progress',    weight: 2 },
  fixed_untested: { label: '🟣 fixed (untested)', weight: 3 },
  fixed_tested:   { label: '🟢 fixed (tested)',  weight: 4 },
  closed:         { label: '✅ closed',          weight: 5 },
  wont_fix:       { label: '⚫ won\'t fix',       weight: 6 },
};
function statusLabel(s) { return STATUS_META[s]?.label || s; }
function statusWeight(s) { return STATUS_META[s] ? STATUS_META[s].weight : 99; }

// Priority -> sort weight. Null priority sorts with P2 (the default).
function priorityWeight(p) {
  return { P0: 0, P1: 1, P2: 2, P3: 3 }[p] ?? 2;
}

async function main() {
  const c = new Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();

  // Skip-if-empty guard (memory:rule cmq4acnh9001bs601y58mjgv4). No rows -> no
  // Doc PATCH, no token spend. Override with FORCE_REFRESH=1.
  const totalRes = await c.query('SELECT COUNT(*)::int AS n FROM bug_reports');
  const totalRows = totalRes.rows[0]?.n || 0;
  if (totalRows === 0 && !process.env.FORCE_REFRESH) {
    await c.end();
    console.log('no new bug reports — skipping refresh');
    return;
  }

  const counts = await c.query(
    'SELECT status, COUNT(*)::int AS n FROM bug_reports GROUP BY status'
  );
  const activeStates = ['open', 'triaged', 'in_progress'];
  const sevCounts = await c.query(
    "SELECT severity, COUNT(*)::int AS n FROM bug_reports WHERE status IN ('open','triaged','in_progress') GROUP BY severity"
  );
  const last24 = await c.query(
    "SELECT COUNT(*)::int AS n FROM bug_reports WHERE created_at > now() - interval '24 hours'"
  );

  // Pull every row with a STABLE bug number assigned by creation order (oldest = #1),
  // so a given report keeps the same number across refreshes regardless of display sort.
  const allRows = (await c.query(
    `SELECT id, user_email, description, severity, source, status, priority,
            screen_name, device_model, os_platform, os_version, app_version,
            app_build, assigned_to, fix_commit,
            created_at, triaged_at, fixed_at, tested_at, closed_at,
            ROW_NUMBER() OVER (ORDER BY created_at ASC, id ASC) AS bug_number
       FROM bug_reports`
  )).rows;
  await c.end();

  const statusMap = Object.fromEntries(counts.rows.map((r) => [r.status, r.n]));
  const sc = (s) => statusMap[s] || 0;
  const activeTotal = activeStates.reduce((a, s) => a + sc(s), 0);
  const sevMap = Object.fromEntries(sevCounts.rows.map((r) => [r.severity, r.n]));

  // Display: active first, then by priority (P0 first), then most recent.
  const display = [...allRows].sort((a, b) => {
    const sw = statusWeight(a.status) - statusWeight(b.status);
    if (sw !== 0) return sw;
    const pw = priorityWeight(a.priority) - priorityWeight(b.priority);
    if (pw !== 0) return pw;
    return new Date(b.created_at) - new Date(a.created_at);
  }).slice(0, 50);

  const tableHeader =
    '| # | Pri | Status | Sev | When | User | Screen | Description | Device | Commit | Resolved |\n' +
    '|---|---|---|---|---|---|---|---|---|---|---|';
  const tableRows = display.map((r) => {
    const desc = (r.description || '').replace(/\|/g, '\\|').replace(/\n/g, ' ').slice(0, 120);
    const device = [
      r.device_model,
      `${r.os_platform || ''} ${r.os_version || ''}`.trim(),
      r.app_version && `v${r.app_version}${r.app_build ? '+' + r.app_build : ''}`,
    ].filter(Boolean).join(' · ');
    const commit = r.fix_commit ? `\`${String(r.fix_commit).slice(0, 7)}\`` : '';
    const resolved = fmtDate(r.closed_at || r.tested_at || r.fixed_at);
    const sev = `${severityEmoji(r.severity)} ${r.severity}`;
    return `| ${r.bug_number} | ${r.priority || 'P2'} | ${statusLabel(r.status)} | ${sev} | ${fmtDateTime(r.created_at)} | ${r.user_email || '—'} | ${r.screen_name || '—'} | ${desc} | ${device || '—'} | ${commit || '—'} | ${resolved || '—'} |`;
  });

  const body = `# Bug Reports — Dev Review

> Live view of \`bug_reports\` from the hosted Supabase project (\`umnowggiuiotsgsnvvuj\`).
> Refreshes daily via the bound Routine. Manual refresh: run \`scripts/refresh-bug-reports-doc.js\`.
> Bug numbers are stable and assigned by creation order (oldest = #1).

## Status summary

- **Active (open + triaged + in progress):** ${activeTotal}
- 🟡 **Open:** ${sc('open')}
- 🟠 **Triaged:** ${sc('triaged')}
- 🔵 **In progress:** ${sc('in_progress')}
- 🟣 **Fixed — untested:** ${sc('fixed_untested')}
- 🟢 **Fixed — tested:** ${sc('fixed_tested')}
- ✅ **Closed:** ${sc('closed')}
- ⚫ **Won't fix:** ${sc('wont_fix')}
- **Last 24h:** ${last24.rows[0]?.n || 0}

## Active by severity

- 😩 **Blocks me:** ${sevMap.blocks || 0}
- 😐 **Annoying:** ${sevMap.annoying || 0}
- 🙂 **Low:** ${sevMap.low || 0}

## Reports (latest 50, active first)

${display.length === 0 ? '_No reports yet — table will populate once users start filing._' : tableHeader + '\n' + tableRows.join('\n')}

---

_Last refreshed ${fmtDateTime(new Date())}_

made with [Tycoon.us](https://tycoon.us) · [superagent](https://tycoon.us)
`;

  const url = `${process.env.TYCTL_BASE_URL}/api/agent/docs/${process.env.BUG_REPORTS_DOC_ID}`;
  const r = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${process.env.TYCTL_AUTH_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      body,
      changeSummary: `Refresh: ${totalRows} total, ${activeTotal} active (${sc('open')} open / ${sc('in_progress')} in-progress / ${sc('fixed_untested')} fixed-untested)`,
    }),
  });
  if (!r.ok) {
    const txt = await r.text();
    console.error(`PATCH ${url} -> ${r.status}: ${txt}`);
    process.exit(2);
  }
  console.log(`✔ Refreshed Doc ${process.env.BUG_REPORTS_DOC_ID}: ${totalRows} total, ${activeTotal} active, ${sc('fixed_untested')} fixed-untested, ${sc('fixed_tested')} fixed-tested`);
}

main().catch((e) => { console.error(e); process.exit(2); });
