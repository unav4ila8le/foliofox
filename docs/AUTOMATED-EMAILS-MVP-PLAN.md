# Automated Emails MVP Plan

## Summary

- Build the MVP on `React Email + Resend`, with Loops staying separate for campaigns and changelog emails.
- Ship two automated emails only: `weekly recap` and `re-engagement`.
- Treat `marketing emails` as a user-facing preference category, not as a delivery type.
- Run the system from one hourly cron route that evaluates user-local timing and inactivity, then sends eligible emails in batches.
- Execute in gated phases. After each phase, stop and wait for your review and explicit green light before continuing.

## Phased Implementation

### Phase 1 — Schema Contract And Type Regeneration

- Have you create a migration file with the next timestamp and slug `create_automated_email_preferences_and_delivery_log`.
- Fill that migration with:
  - `profiles.last_app_activity_at timestamptz null`
  - enum `automated_email_type` with `weekly_recap` and `reengagement`
  - enum `automated_email_delivery_status` with `pending`, `sent`, and `failed`
  - table `email_preferences` with `user_id` primary key, `weekly_recap_enabled boolean not null default true`, `marketing_emails_enabled boolean not null default true`, `created_at`, `updated_at`
  - table `automated_email_deliveries` with `id`, `user_id`, `email_type`, `delivery_key`, `status`, `provider_message_id`, `error_message`, `sent_at`, `created_at`, `updated_at`, plus unique `(user_id, email_type, delivery_key)`
- Backfill one `email_preferences` row for every existing profile with both preferences enabled, because you chose default-on for everyone.
- Update `handle_new_user()` so new signups automatically get an `email_preferences` row with both preferences enabled.
- Add RLS so users can read and update only their own `email_preferences` row. Keep `automated_email_deliveries` service-only.
- Stop here. You apply the migration and regenerate [database.types.ts](/Users/leonardo/Code/foliofox/types/database.types.ts). No migration is ever applied by me.

### Phase 2 — Server Foundations And Shared Digest Logic

- Add typed server helpers for `fetchEmailPreferences`, `updateEmailPreferences`, and `touchLastAppActivity`.
- Extend dashboard data hydration so client settings can read current email preferences without duplicate fetch paths.
- Add a small client-side activity tracker in the dashboard route group that updates `profiles.last_app_activity_at` only when stale, with a `6 hour` local throttle to avoid noisy writes.
- Create one shared digest builder used by both emails. It should compose existing analysis helpers instead of duplicating calculations:
  - net worth now and change over a caller-supplied comparison range
  - top movers over the same range
  - projected dividend income for the next `30` days
- Omit empty sections instead of fabricating filler content. Skip the whole email if the user has no active positions.
- Add a sender abstraction with a `Resend` adapter only for MVP, but keep the interface provider-shaped so SMTP can be added later without rewriting callers.
- Resolve recipient email addresses from Supabase Auth in a concurrency-limited helper for due users only. Do not duplicate auth email into public tables in MVP.
- Add signed one-click unsubscribe token utilities with a dedicated `EMAIL_LINK_SECRET`.
- Add delivery-log orchestration:
  - create `pending` row before send
  - call Resend with existing retry helpers
  - update each row to `sent` or `failed`
  - use `delivery_key` for dedupe
- Map preferences to automation eligibility like this:
  - `weekly recap` checks `weekly_recap_enabled`
  - `re-engagement` checks `marketing_emails_enabled`
- Stop here and wait for review after server tests pass.

### Phase 3 — Templates, Settings UI, And Unsubscribe UX

- Add a dedicated `emails/` directory for React Email templates and local preview tooling.
- Add a small shared email theme module so branding, spacing, footer copy, and CTA styling stay consistent across both emails.
- Build two templates:
  - `Weekly recap`: net worth delta, top gainers and losers, upcoming income, dashboard CTA
  - `Re-engagement`: shorter version with “since your last visit” framing, strongest mover insight, dashboard CTA
- Add a new email-preferences section to the existing settings surface with two toggles:
  - `Weekly recap`
  - `Marketing emails`
- Keep the user-facing wording category-based:
  - the re-engagement email is presented as part of `Marketing emails`
  - future marketing automations can reuse the same preference
- Add a public unsubscribe route and confirmation page. The one-click link disables only the relevant preference:
  - weekly recap email disables `weekly_recap_enabled`
  - re-engagement email disables `marketing_emails_enabled`
- Include in every automated email:
  - settings link
  - one-click unsubscribe link
  - clear “why you received this” footer copy
- Stop here and wait for review of content, copy, and UX.

### Phase 4 — Cron, Scheduling, And Docs

- Add one hourly cron route: `GET /api/cron/send-automated-emails`.
- Reuse the current cron security pattern with `CRON_SECRET`, `connection()`, structured JSON stats, retry logging, and chunking.
- Apply these due rules:
  - weekly recap sends Monday `9:00 AM` in the user’s local timezone
  - re-engagement sends after `14` full days since `last_app_activity_at`
  - re-engagement sends at most once every `21` days
  - if both emails are eligible on the same local day, weekly recap wins and re-engagement is skipped for that run
- Use these `delivery_key` rules:
  - weekly recap: `weekly:<local-monday-date>`
  - re-engagement: `reengagement:<local-send-date>`
- Keep delivery logging specific even when preferences are category-based:
  - `automated_email_type.weekly_recap`
  - `automated_email_type.reengagement`
- Batch Resend sends in chunks of `100`.
- Make the whole system a no-op when email env vars are missing or `AUTOMATED_EMAILS_ENABLED=false`, so self-hosters are not forced to configure it.
- Update deployment and contributor docs for env vars, hourly cron setup, local React Email preview, and the manual migration workflow.
- Stop for final review.

## Important Interfaces And Contract Changes

- New database enums:
  - `automated_email_type`
  - `automated_email_delivery_status`
- New tables:
  - `email_preferences`
  - `automated_email_deliveries`
- New profile field:
  - `last_app_activity_at`
- New exported DB-backed constants in `types/enums.ts` for the new enums.
- New dashboard client data:
  - `emailPreferences`
- New server entry points:
  - `fetchEmailPreferences`
  - `updateEmailPreferences`
  - `touchLastAppActivity`
  - `buildAutomatedEmailDigest`
  - `sendAutomatedEmails` orchestration
- New env vars:
  - `RESEND_API_KEY`
  - `EMAILS_FROM_ADDRESS`
  - `EMAIL_LINK_SECRET`
  - `AUTOMATED_EMAILS_ENABLED`
- Preference-to-email contract:
  - `weekly_recap_enabled` controls only weekly recap emails
  - `marketing_emails_enabled` controls re-engagement now and future marketing automations later
  - delivery logs still store the concrete email type, not the preference category
- New public behavior:
  - one-click unsubscribe per preference category without login
  - re-enable only from authenticated settings

## Test Plan

- Migration-level checks:
  - existing users are backfilled with enabled preferences
  - new signup trigger creates preference row
  - RLS allows only self read/update on `email_preferences`
- Server helper tests:
  - digest builder reuses existing analysis utilities and omits empty sections correctly
  - activity touch is throttled and does not revalidate dashboard unnecessarily
  - unsubscribe token verification accepts valid tokens and rejects tampered or expired ones
  - preference gating maps `reengagement -> marketing_emails_enabled` correctly
- Selector/orchestration tests:
  - Monday `9:00 AM` local matching works across different timezones
  - weekly recap dedupe prevents duplicate sends for the same local week
  - re-engagement respects `14 day` inactivity and `21 day` cooldown
  - weekly recap suppresses re-engagement when both are due
  - users with disabled preferences or no active positions are skipped
- Template tests:
  - HTML and plain text render successfully
  - both templates include footer, settings link, and one-click unsubscribe
  - re-engagement unsubscribe points to the `marketing emails` preference
- Route tests:
  - cron route rejects invalid auth
  - cron route returns structured stats
  - partial provider failures mark only affected delivery rows as failed

## Assumptions And Defaults

- MVP includes only `weekly recap` and `re-engagement`. `52-week-high` is deferred.
- Both preferences default to enabled for existing and new users, per your decision.
- Weekly recap default timing is Monday `9:00 AM` local time.
- Re-engagement starts after `14` inactive days and is capped at once every `21` days.
- `Marketing emails` is the user-facing category. `reengagement` remains the internal delivery type.
- Recipient email addresses remain sourced from Supabase Auth, not duplicated into public tables.
- No Resend webhook ingestion, bounce automation, or complaint handling in MVP.
- No SMTP adapter in MVP, but the sender boundary is designed so it can be added later.
- Complex orchestration files should follow the repo’s current commenting style: exported docblocks, explicit naming, and numbered flow comments in multi-step logic.

## Vercel Cron

{
"path": "/api/cron/send-automated-emails",
"schedule": "0 \* \* \* \*"
}
