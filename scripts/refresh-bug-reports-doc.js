#!/usr/bin/env node
/**
 * Refresh the "Bug Reports — Dev Review" Doc.
 *
 * Reads the latest 50 rows from public.bug_reports, builds a markdown table +
 * status summary, and PATCHes the Doc body via the tyny agent API.
 *
 * Env required:
 *   SUPABASE_DB_URL        — postgres connection string (uses pg pooler or direct)
 *   TYCTL_BASE_URL         — tyny base URL (e.g. https://app.tyny.dev)
 *   TYCTL_AUTH_TOKEN       — pod bearer token
 *   BUG_REPORTS_DOC_ID     — Doc.id to update
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

function fmt(d) {
  if (!d) return '';
  const t = new Date(d);
  return t.toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
}

function severityEmoji(s) {
  return { low: '🙂', annoying: '😐', blocks: '😩' }[s] || s;
}

function sourceEmoji(s) {
  return { manual: '🐞', js_error: '⚠️', native_crash: '💥', unhandled_promise: '⛔' }[s] || s;
}

function statusEmoji(s) {
  return { open: '🟡 open', triaged: '🟠 triaged', fixed: '🟢 fixed', wontfix: '⚫ wontfix' }[s] || s;
}

async function main() {
  const c = new Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();

  const counts = await c.query(
    "SELECT status, COUNT(*)::int AS n FROM bug_reports GROUP BY status ORDER BY status"
  );
  const sevCounts = await c.query(
    "SELECT severity, COUNT(*)::int AS n FROM bug_reports WHERE status IN ('open','triaged') GROUP BY severity ORDER BY severity"
  );
  const last24 = await c.query(
    "SELECT COUNT(*)::int AS n FROM bug_reports WHERE created_at > now() - interval '24 hours'"
  );
  const rows = (await c.query(
    `SELECT id, user_email, description, severity, source, status, screen_name,
            device_model, os_platform, os_version, app_version, app_build, created_at
       FROM bug_reports
       ORDER BY created_at DESC
       LIMIT 50`
  )).rows;
  await c.end();

  const statusMap = Object.fromEntries(counts.rows.map((r) => [r.status, r.n]));
  const open = (statusMap.open || 0) + (statusMap.triaged || 0);
  const fixed = statusMap.fixed || 0;
  const wontfix = statusMap.wontfix || 0;
  const blocks = sevCounts.rows.find((r) => r.severity === 'blocks')?.n || 0;
  const annoying = sevCounts.rows.find((r) => r.severity === 'annoying')?.n || 0;
  const low = sevCounts.rows.find((r) => r.severity === 'low')?.n || 0;

  const tableHeader =
    '| When | User | Severity | Source | Screen | Device | Description |\n' +
    '|---|---|---|---|---|---|---|';
  const tableRows = rows.map((r) => {
    const desc = (r.description || '').replace(/\|/g, '\\|').replace(/\n/g, ' ').slice(0, 140);
    const device = [r.device_model, `${r.os_platform || ''} ${r.os_version || ''}`.trim(), r.app_version && `v${r.app_version}${r.app_build ? '+' + r.app_build : ''}`]
      .filter(Boolean).join(' · ');
    return `| ${fmt(r.created_at)} | ${r.user_email || '—'} | ${severityEmoji(r.severity)} ${r.severity} | ${sourceEmoji(r.source)} ${r.source} | ${r.screen_name || '—'} | ${device || '—'} | ${desc} |`;
  });

  const body = `# Bug Reports — Dev Review

> Live view of \`bug_reports\` from the hosted Supabase project (\`umnowggiuiotsgsnvvuj\`).
> Refreshes hourly via the bound Routine. Manual refresh: run \`scripts/refresh-bug-reports-doc.js\`.

## Status summary

- **Open (open + triaged):** ${open}
- **Fixed:** ${fixed}
- **Won't fix:** ${wontfix}
- **Last 24h:** ${last24.rows[0]?.n || 0}

## Active by severity

- 😩 **Blocks me:** ${blocks}
- 😐 **Annoying:** ${annoying}
- 🙂 **Low:** ${low}

## Last 50 reports

${rows.length === 0 ? '_No reports yet — table will populate once users start filing._' : tableHeader + '\n' + tableRows.join('\n')}

---

_Last refreshed ${fmt(new Date())}_

made with [Tycoon.us](https://tycoon.us) · [superagent](https://tycoon.us)
`;

  const url = `${process.env.TYCTL_BASE_URL}/api/agent/docs/${process.env.BUG_REPORTS_DOC_ID}`;
  const r = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${process.env.TYCTL_AUTH_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ body, changeSummary: `Hourly refresh: ${rows.length} rows, ${open} open` }),
  });
  if (!r.ok) {
    const txt = await r.text();
    console.error(`PATCH ${url} -> ${r.status}: ${txt}`);
    process.exit(2);
  }
  console.log(`✔ Refreshed Doc ${process.env.BUG_REPORTS_DOC_ID}: ${rows.length} rows, ${open} open, ${blocks} blocks`);
}

main().catch((e) => { console.error(e); process.exit(2); });
