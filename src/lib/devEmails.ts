/**
 * Email allowlist for in-app Developer-only surfaces (hidden Dev section,
 * deliberate-crash triggers). Updated by adding entries below and shipping
 * a new build. Server-side dev access is enforced separately via the
 * `bug_reports` RLS policy on the database.
 */
export const DEV_EMAILS = ['dan@amaze.net'] as const;

export function isDevUser(email: string | null | undefined): boolean {
  if (!email) return false;
  return DEV_EMAILS.includes(email.trim().toLowerCase() as (typeof DEV_EMAILS)[number]);
}
