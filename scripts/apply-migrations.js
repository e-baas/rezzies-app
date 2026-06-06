#!/usr/bin/env node
/**
 * Apply all SQL files in supabase/migrations/ to the hosted Supabase project.
 *
 * Usage:
 *   SUPABASE_DB_URL="postgresql://postgres.<ref>:<pwd>@aws-0-<region>.pooler.supabase.com:6543/postgres" \
 *     node scripts/apply-migrations.js
 *
 * Each migration is executed atomically. Migrations are idempotent
 * (CREATE IF NOT EXISTS / DROP POLICY IF EXISTS / DO $$ ... EXCEPTION).
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const dbUrl = process.env.SUPABASE_DB_URL;
if (!dbUrl) {
  console.error('SUPABASE_DB_URL not set');
  process.exit(1);
}

async function main() {
  const dir = path.join(__dirname, '..', 'supabase', 'migrations');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  console.log('Migrations found:', files.join(', '));

  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  for (const file of files) {
    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    console.log(`\n=== Applying ${file} (${sql.length} bytes) ===`);
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('COMMIT');
      console.log(`✔ ${file}`);
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      console.error(`✗ ${file}:`, err.message);
      throw err;
    }
  }

  const { rows } = await client.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema='public' ORDER BY table_name
  `);
  console.log('\nTables in public schema:', rows.map((r) => r.table_name).join(', '));

  const { rows: policies } = await client.query(`
    SELECT tablename, policyname FROM pg_policies WHERE schemaname='public'
    ORDER BY tablename, policyname
  `);
  console.log(`\nRLS policies (${policies.length}):`);
  policies.forEach((p) => console.log(`  ${p.tablename}.${p.policyname}`));

  await client.end();
}

main().catch((err) => { console.error(err); process.exit(1); });
