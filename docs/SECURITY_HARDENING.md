# Security Hardening Checklist

Last updated: 2026-05-19

This checklist captures the current security posture and the next hardening moves before the app is exposed as a production service.

## Current Protections

- Host pages require an authenticated user session.
- Party mutation routes check host ownership before writing data.
- `/admin` requires `ADMIN` role and returns 404 for non-admin users.
- Guest play access uses guest tokens and redirects invalid cookies instead of mutating cookies during render.
- Player card, evidence, media, accusation, victim reveal, and final reveal content are filtered through server-side visibility rules.
- Audit logs record core host, player, admin content, support, party status, invite resend, and outbound retry mutations.
- Database-backed rate limiting is active for login, signup, guest join, support ticket intake, and checkout-start.
- CSRF tokens are wired into mutation forms and route handlers. Missing tokens remain permissive in development/test, but production rejects missing or invalid tokens.
- Checkout can create pending orders and Stripe checkout sessions when configured.
- Stripe webhook signature verification and idempotent webhook event storage are implemented.
- Payment fulfillment is idempotent and grants `UserGameAccess` from paid orders.
- Upload validation helpers enforce allowed MIME types and size limits before uploads are enabled.

## High-Priority Gaps

1. Production CSRF secret.
   - Set `CSRF_SECRET` before production.
   - Keep the production missing-token rejection behavior.
   - Add browser-level regression tests around invalid tokens once the app has a dedicated test database.

2. Account lifecycle.
   - Add email verification, password reset, and account recovery.
   - Add session revocation tooling for admins/support.
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

6. File and media safety.
   - Upload storage is not enabled yet.
   - Before uploads, add malware scanning, private object storage paths, signed URLs, and admin review workflow.

7. Database backups and restore drills.
   - Use timestamped backups before risky migrations.
   - Practice restoring to a separate database.
   - Never test restore procedures first on the live database.

8. Error handling and logs.
   - Avoid leaking stack traces to users in production.
   - Add structured server logs for auth failures, checkout attempts, webhook failures, support requests, and admin actions.

9. Admin scope.
   - Admin pages expose spoiler content and platform activity.
   - Add separate admin roles later: support, content editor, finance, super admin.
   - Add status history/threaded notes for support when email replies are implemented.

10. Abuse prevention.
   - Add CAPTCHA or challenge flow only if rate limits are not enough.
   - Add suspicious invite-code attempt monitoring.
   - Add outbound message throttles before enabling real email/SMS delivery.

## Route Review

| Route | Current Risk | Next Hardening |
| --- | --- | --- |
| `/login` | Brute force attempts | Rate limit is active; add login audit events and account lockout policy later |
| `/signup` | Spam accounts | Rate limit is active; add email verification |
| `/join` | Invite-code guessing | Rate limit is active; add suspicious attempt audit events |
| `/play` | Guest token misuse | Token rotation/reissue flow later |
| `/host/party/[partyId]/*` | Unauthorized mutation | Ownership checks and CSRF are active; add more mutation-specific tests |
| `/checkout/start` | Payment abuse | Rate limit, CSRF, pending orders, and Stripe checkout foundation are active |
| `/api/webhooks/payments/stripe` | Spoofed payment events | Stripe HMAC signature verification and idempotency are active |
| `/support` | Spam | Rate limit is active; add spam filtering later |
| `/admin` | Sensitive data exposure | Role lock and audit logging are active; split admin roles later |

## Environment Variables To Document

- `DATABASE_URL`
- `NODE_ENV`
- `APP_URL`
- `CSRF_SECRET`
- `PAYMENT_PROVIDER`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `EMAIL_PROVIDER`
- `EMAIL_API_KEY`
- `SMS_PROVIDER`
- `SMS_API_KEY`
- Object storage endpoint, bucket, access key, and secret

## Recommended Next Code Changes

1. Add email verification and password reset.
2. Add dedicated test database setup and fixture cleanup scripts.
3. Add structured logging for webhook, support, auth, and admin events.
4. Add outbound email delivery adapter after choosing Resend, Postmark, SendGrid, SES, or another provider.
5. Add role-specific admin permissions before hiring support/content staff.
