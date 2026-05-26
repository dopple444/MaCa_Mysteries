# Security Hardening Checklist

Last updated: 2026-05-22

This checklist captures the current security posture and the next hardening moves before the app is exposed as a production service.

## Current Protections

- Host pages require an authenticated user session.
- Party mutation routes check host ownership before writing data.
- `/admin` requires an operational admin role and returns 404 for normal hosts/players.
- Guest play access uses guest tokens and redirects invalid cookies instead of mutating cookies during render.
- Player card, evidence, media, accusation, victim reveal, and final reveal content are filtered through server-side visibility rules.
- Conditional reveal checks hide cards/evidence/media that require unlock rules until the current player has an authorized unlock event.
- Access-code tool instances and attempts store salted hashes instead of raw codes.
- Player code-entry is CSRF-protected, rate-limited, validates target availability server-side, and redirects through generic status messages.
- Host conditional activity monitoring redacts rule/tool labels until host spoiler mode is unlocked and never returns stored code hashes.
- Admin conditional activity monitoring shows recent platform-wide code attempts, failed attempts, and unlock events without selecting or exposing stored code hashes.
- Repeated failed access-code attempts can queue deduped admin alert emails through `OutboundMessage`.
- Audit logs record core host, player, admin content, support, party status, invite resend, spoiler unlock, outbound retry, and auth/account-security events.
- Super-admin user operations can assign roles, revoke sessions, search/filter accounts, and review recent account-security audit events, with bootstrap access for the first super administrator.
- Guest invitation delivery state is server-side and does not expose gameplay spoilers.
- Database-backed rate limiting is active for login, signup, guest join, support ticket intake, and checkout-start.
- Email verification and password reset use signed account-action links delivered through queued email.
- CSRF tokens are wired into mutation forms and route handlers. Missing tokens remain permissive in development/test, but production rejects missing or invalid tokens.
- Checkout can create pending orders and Stripe checkout sessions when configured.
- Stripe webhook signature verification and idempotent webhook event storage are implemented.
- Payment fulfillment is idempotent and grants `UserGameAccess` from paid orders.
- Local admin upload routes enforce allowed MIME types, size limits, and public/private path separation.

## High-Priority Gaps

1. Production CSRF secret.
   - Set `CSRF_SECRET` before production.
   - Keep the production missing-token rejection behavior.
   - Add browser-level regression tests around invalid tokens now that the app has a dedicated test database.

2. Account lifecycle.
   - Email verification and password reset foundations are implemented.
   - Support/admin recovery procedures are documented in `docs/ACCOUNT_RECOVERY_PROCEDURES.md`.
   - Add admin recovery tooling before support staff handle real accounts.
   - Session revocation tooling now exists for super-admin account operations.
   - Add richer account recovery review workflows before support staff handle sensitive account changes.
   - Account-security audit history is visible to super admins; add approval workflow before delegated staff can perform sensitive role changes.
   - Consider session rotation after login and sensitive account changes.

3. Secret management.
   - Keep `.env` out of source control.
   - Move production secrets into a server secret manager or deployment environment.
   - Rotate provider secrets after any suspected exposure.

4. Payment production readiness.
   - Use Stripe test mode first.
   - Configure `PAYMENT_PROVIDER=stripe`, `STRIPE_SECRET_KEY`, and `STRIPE_WEBHOOK_SECRET`.
   - Verify webhook delivery from Stripe Dashboard before selling real games.

5. Spoiler leakage.
   - Continue testing player-safe visibility helpers.
   - Avoid rendering spoiler-protected body text in host-safe views unless spoiler mode exists and is intentionally unlocked.
   - Keep admin pages restricted because they expose full game content.
   - Keep conditional unlock logic in shared server-side services so future digital artifacts and tools do not bypass player-safe filters.

6. Conditional unlock abuse.
   - Player code-entry now has guest-scoped rate limiting; keep tuning limits as real gameplay patterns appear.
   - Keep raw codes out of logs, database records, and user-visible error messages.
   - Host-side and admin/global unlock monitoring and suspicious-attempt alert queueing exist; add provider delivery monitoring and threshold tuning after real gameplay testing.
   - Admin builder editor services now validate version-owned targets/source tools and require access-code rules to use access-code generator tools.
   - Publish validation now blocks missing essential content, orphan required unlock rules, unpublished required rules, unattached published rules, and access-code rules without generator tools.
   - Expand publish validation for circular dependencies, spoiler wording, asset-view rules, host-approval rules, reveal-state rules, and multi-player interaction rules.

7. File and media safety.
   - Local admin uploads are enabled for trusted admins.
   - Before production uploads, add malware scanning, S3-compatible object storage writes, signed URLs for private files, and admin review workflow.

8. Database backups and restore drills.
   - Use timestamped backups before risky migrations.
   - Practice restoring to a separate database.
   - Never test restore procedures first on the live database.

9. Error handling and logs.
   - Avoid leaking stack traces to users in production.
   - Add structured server logs for auth failures, checkout attempts, webhook failures, support requests, and admin actions.

10. Admin scope.
   - Admin pages expose spoiler content and platform activity.
   - Separate admin roles now exist for support, content editor, finance, and super admin.
   - Admin pages and mutation routes are gated by content, payment, support, and outbound-message permissions.
   - Add status history automation for support as volume grows.

11. Abuse prevention.
   - Add CAPTCHA or challenge flow only if rate limits are not enough.
   - Add suspicious invite-code attempt monitoring.
   - Add outbound message throttles before enabling real email/SMS delivery.

## Route Review

| Route | Current Risk | Next Hardening |
| --- | --- | --- |
| `/login` | Brute force attempts | Rate limit and login audit events are active; add account lockout policy later |
| `/signup` | Spam accounts | Rate limit is active and signup queues email verification |
| `/join` | Invite-code guessing | Rate limit is active; add suspicious attempt audit events |
| `/play` | Guest token misuse | Token rotation/reissue flow later |
| `/play/unlock` | Brute force or spoiler probing | Guest-scoped rate limiting, CSRF, raw-code hashing, target checks, host activity monitoring, admin/global monitoring, and suspicious-attempt alert queueing are active |
| `/admin/conditional-activity/alerts` | Alert spam or unauthorized operations visibility | Admin-only CSRF route queues deduped alert emails and audits the action |
| `/host/party/[partyId]/*` | Unauthorized mutation | Ownership checks and CSRF are active; add more mutation-specific tests |
| `/checkout/start` | Payment abuse | Rate limit, CSRF, pending orders, and Stripe checkout foundation are active |
| `/api/webhooks/payments/stripe` | Spoofed payment events | Stripe HMAC signature verification and idempotency are active |
| `/support` | Spam | Rate limit is active; add spam filtering later |
| `/admin` | Sensitive data exposure | Role-specific admin permissions, audit logging, and super-admin user management are active |
| `/admin/users` | Account takeover or staff over-permissioning | Super-admin-only role assignment/session revocation is active, with bootstrap only when no super admin exists and recent account-security history visible; add approval workflow later |

## Environment Variables To Document

- `DATABASE_URL`
- `NODE_ENV`
- `APP_URL`
- `CSRF_SECRET`
- `ACCOUNT_TOKEN_SECRET`
- `PAYMENT_PROVIDER`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `EMAIL_PROVIDER`
- `EMAIL_API_KEY`
- `SMS_PROVIDER`
- `SMS_API_KEY`
- Object storage endpoint, bucket, access key, and secret

## Recommended Next Code Changes

1. Add admin account recovery review workflow and sensitive role-change approval policy.
2. Expand dedicated test database coverage with more browser-level mutation tests.
3. Add structured logging for webhook, support, auth, and admin events.
4. Configure production email sender/domain and add outbound delivery event webhooks after choosing the live provider account.
5. Expand publish-readiness validation for circular dependencies, spoiler wording, and non-code trigger types.
6. Tune suspicious-attempt thresholds after real staging gameplay tests.
7. Add approval policy for role changes before hiring support/content staff.
