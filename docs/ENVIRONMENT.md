# Environment Variables

Last updated: 2026-05-19

## Required Now

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL connection string used by Prisma. |
| `DATABASE_URL_TEST` | Recommended for development | PostgreSQL connection string used by `npm test` when live-route testing is not enabled. |
| `NODE_ENV` | Recommended | Controls production cookie behavior, CSRF strictness, and development purchase bypass behavior. |
| `APP_URL` | Recommended | Canonical public URL for checkout redirects, emails, support links, and webhooks. |
| `CSRF_SECRET` | Required before production | HMAC secret for CSRF tokens. Development falls back to `DATABASE_URL`, but production should use a dedicated long random secret. |
| `ACCOUNT_TOKEN_SECRET` | Required before production | HMAC secret for email verification and password reset links. Development falls back to `CSRF_SECRET` or `DATABASE_URL`, but production should use a dedicated long random secret. |

## Payment Provider

Stripe is the first provider target. Local `.env` can safely set `PAYMENT_PROVIDER=stripe` before keys exist; checkout returns a not-configured response until the Stripe secret key is added.

| Variable | Required | Purpose |
| --- | --- | --- |
| `PAYMENT_PROVIDER` | When enabling payments | Set to `stripe` to enable Stripe checkout session creation. |
| `STRIPE_SECRET_KEY` | When enabling Stripe checkout | Secret API key used to create checkout sessions. |
| `STRIPE_WEBHOOK_SECRET` | When enabling Stripe webhooks | Webhook signing secret used by `/api/webhooks/payments/stripe`. |

See `docs/PAYMENT_PROVIDER_SETUP.md` for the Stripe setup and test-checkout checklist.

## Outbound Messages

Outbound messages are queued in PostgreSQL. Email delivery supports local console mode and Resend. SMS delivery remains disabled until a provider adapter and credentials are added.

| Variable | Required | Purpose |
| --- | --- | --- |
| `EMAIL_PROVIDER` | When enabling email | Use `console` for local dry-run delivery or `resend` for Resend HTTP delivery. |
| `EMAIL_API_KEY` | When enabling Resend | Email provider credential. |
| `EMAIL_FROM` | When enabling Resend | Verified sender address, such as `MaCa Mysteries <hello@example.com>`. |
| `SMS_PROVIDER` | Later | Provider name for SMS delivery, such as Twilio. |
| `SMS_API_KEY` | Later | SMS provider credential. |

## Object Storage

Local admin upload endpoints are enabled. Public local uploads are written under `public/uploads/media`, and private local uploads are written under `storage/private/media` until signed URL serving is implemented. Storage policy helpers also detect future S3-compatible configuration.

| Variable | Required | Purpose |
| --- | --- | --- |
| `OBJECT_STORAGE_ENDPOINT` | Later | S3-compatible storage endpoint. |
| `OBJECT_STORAGE_BUCKET` | Later | Media upload bucket. |
| `OBJECT_STORAGE_ACCESS_KEY_ID` | Later | Object storage access key. |
| `OBJECT_STORAGE_SECRET_ACCESS_KEY` | Later | Object storage secret key. |

## Provider Foundations

- Payment checkout can create pending orders and redirect to Stripe when `PAYMENT_PROVIDER=stripe` and `STRIPE_SECRET_KEY` are configured.
- Stripe webhooks are verified with `STRIPE_WEBHOOK_SECRET`, recorded idempotently in `PaymentWebhookEvent`, and can fulfill paid orders.
- Email/SMS outbound provider helpers read `EMAIL_PROVIDER` and `SMS_PROVIDER`.
- Invitation emails are queued as `OutboundMessage` records, update guest invitation delivery state, can be delivered through console or Resend email adapters, and can be retried from admin if marked failed.
- Account email verification and password reset links are signed with `ACCOUNT_TOKEN_SECRET` and delivered through queued email messages.
- SMS support has user phone/preference fields and an account notification settings screen, but sending remains disabled until a provider adapter exists.
- Local admin uploads validate file name, MIME type, size, and public/private path rules. S3-compatible writes and private signed URL serving remain future work.

## Validation

The app validates required server environment variables from `app/lib/env.ts`. At the moment, `DATABASE_URL` is the only hard startup requirement.

If startup fails with:

```text
Missing required server environment variable(s): DATABASE_URL
```

then load the app environment before running Next, Prisma, tests, or scripts.

## Development Notes

- Current local server URL: `http://192.168.2.45:3001`
- Current app command: `npm run dev -- -H 0.0.0.0 -p 3001`
- Current migration command: `npx prisma migrate deploy`
- Current seed command: `npm run prisma:seed`
- Current test database prepare command: `npm run test:prepare`
- Current standard test command: `npm test`
- Current live-route test command: `TEST_BASE_URL=http://127.0.0.1:3001 npm test`
