# Environment Variables

Last updated: 2026-05-19

## Required Now

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL connection string used by Prisma. |
| `NODE_ENV` | Recommended | Controls production cookie behavior, CSRF strictness, and development purchase bypass behavior. |
| `APP_URL` | Recommended | Canonical public URL for checkout redirects, emails, support links, and webhooks. |
| `CSRF_SECRET` | Required before production | HMAC secret for CSRF tokens. Development falls back to `DATABASE_URL`, but production should use a dedicated long random secret. |

## Payment Provider

Stripe is the first provider target. The code remains safe when these are absent: checkout creates no provider session and returns a not-configured response.

| Variable | Required | Purpose |
| --- | --- | --- |
| `PAYMENT_PROVIDER` | When enabling payments | Set to `stripe` to enable Stripe checkout session creation. |
| `STRIPE_SECRET_KEY` | When enabling Stripe checkout | Secret API key used to create checkout sessions. |
| `STRIPE_WEBHOOK_SECRET` | When enabling Stripe webhooks | Webhook signing secret used by `/api/webhooks/payments/stripe`. |

## Outbound Messages

Outbound messages are queued in PostgreSQL. Real delivery remains disabled until a provider adapter and credentials are added.

| Variable | Required | Purpose |
| --- | --- | --- |
| `EMAIL_PROVIDER` | Later | Provider name for email delivery, such as Resend, Postmark, SendGrid, or SES. |
| `EMAIL_API_KEY` | Later | Email provider credential. |
| `SMS_PROVIDER` | Later | Provider name for SMS delivery, such as Twilio. |
| `SMS_API_KEY` | Later | SMS provider credential. |

## Object Storage

Upload endpoints are not enabled yet, but storage policy helpers already understand local versus S3-compatible configuration.

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
- Invitation emails are queued as `OutboundMessage` records and can be retried from admin if marked failed.
- SMS support has user phone/preference fields and an account notification settings screen, but sending remains disabled until a provider adapter exists.
- Object storage policy helpers validate file name, MIME type, size, and provider configuration before uploads are enabled.

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
