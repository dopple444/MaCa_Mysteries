# Payment Provider Setup

Last updated: 2026-05-22

The app is wired for Stripe Checkout as the first payment provider. Sandbox checkout has been tested successfully with Stripe-hosted payment collection, paid order fulfillment, active game access, and queued purchase confirmation emails.

Official references:

- Stripe Checkout Sessions API: https://docs.stripe.com/api/checkout/sessions/create
- Stripe webhooks: https://docs.stripe.com/webhooks
- Stripe CLI install: https://docs.stripe.com/stripe-cli/install
- Stripe test cards: https://docs.stripe.com/testing

## Current Staging State

Local `.env` is intentionally not committed, but the running staging server should be prepared with Stripe mode flags shaped like this:

```text
APP_URL="https://staging.macamysteries.com"
PAYMENT_PROVIDER="stripe"
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
```

Secrets are intentionally omitted from this document. `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` are set locally if `npm run payment:check` reports them as set.

The public staging site currently runs through Cloudflare Tunnel to the Ubuntu dev server on port `3001`. The old local Stripe CLI listener is no longer required for staging once the Stripe Dashboard webhook endpoint is active.

## Stripe API Key Setup

1. Create or sign in to a Stripe account.
2. Keep the dashboard in Sandbox/Test mode while we are testing.
3. Open Developers > API keys.
4. Copy the test secret key.
5. Put it in `.env`:

```text
STRIPE_SECRET_KEY="sk_test_..."
```

Do not paste live keys into chat, commit them, or put them in `.env.example`.

## Stripe Dashboard Webhook Setup

Create a Stripe Dashboard webhook endpoint in Sandbox/Test mode:

```text
https://staging.macamysteries.com/api/webhooks/payments/stripe
```

Use:

- Endpoint type: Account
- Event selection: `checkout.session.completed`

After creating the endpoint, reveal the signing secret that starts with `whsec_` and put it in `.env`:

```text
STRIPE_WEBHOOK_SECRET="whsec_..."
```

Restart the app after editing `.env`. The app verifies the Stripe signature, records webhook events idempotently, marks paid orders, grants game access, and queues a purchase confirmation email.

## Optional Local Webhook Setup

Use this only when testing on `127.0.0.1` without the public staging tunnel. The local app webhook endpoint is:

```text
http://127.0.0.1:3001/api/webhooks/payments/stripe
```

The Stripe CLI is installed locally at `tools/stripe/stripe` because this server requires an interactive sudo password for system-level installs. The local binary is intentionally ignored by Git.

Authenticate the local Stripe CLI:

```bash
npm run stripe:login
```

The CLI will print a pairing URL. Open that URL in your browser, confirm it in Stripe, then return to the terminal.

After login, run:

```bash
npm run stripe:listen
```

Stripe CLI will print a webhook signing secret that starts with `whsec_`. Put that value in `.env`:

```text
STRIPE_WEBHOOK_SECRET="whsec_..."
```

Restart the local server after editing `.env`. If you use the local listener, run it in tmux session `maca-stripe-listener` and remember that its `whsec_` value is different from the Stripe Dashboard webhook secret.

## Verify Configuration

Run:

```bash
npm run payment:check
```

Expected once fully configured:

```text
Stripe payment provider settings look ready.
```

The current local setup has passed this check.

## Restart Staging App

Use this when the app cannot be reached or after `.env` payment changes:

```bash
tmux kill-session -t maca-mysteries 2>/dev/null || true
rm -rf .next
tmux new-session -d -s maca-mysteries
tmux send-keys -t maca-mysteries 'cd /home/dopple444/projects/MaCa_Mysteries && npm run dev -- -H 0.0.0.0 -p 3001' C-m
```

Then verify:

```bash
curl -I https://staging.macamysteries.com/games
tmux ls
```

`tmux ls` should show the `maca-mysteries` app session. It does not need to show `maca-stripe-listener` for staging Dashboard webhook delivery.

## Test Checkout

1. Make sure the staging site is running at `https://staging.macamysteries.com`.
2. Make sure the Stripe Dashboard webhook endpoint is active in Sandbox/Test mode.
3. Sign in to the app.
4. Open a published game detail page.
5. Use `Purchase access`.
6. In Stripe Checkout test mode, use card number `4242 4242 4242 4242`, any valid future date, any CVC, and any postal code.
7. After payment, confirm:
   - Stripe redirects back to the app.
   - Admin order detail shows the order as paid.
   - Admin payment webhooks shows a processed `checkout.session.completed` event.
   - Admin outbound messages shows a `purchase_confirmation` email queued.
   - The account order/access page shows active game access.
   - The host can create a party for the purchased game.

Previous sandbox result:

- `checkout.session.completed` was received from Stripe.
- Webhook route returned `200`.
- Order status changed to `PAID`.
- `UserGameAccess` was created for Murder at Hollow Lake.

Current staging readiness result:

- `https://staging.macamysteries.com/api/health` returns healthy.
- The webhook endpoint is publicly reachable and rejects invalid signatures with `400`.
- Automated staging tests pass against the public URL.
- Public sandbox checkout with an external test user completed successfully on 2026-05-22.
- The Stripe Dashboard webhook endpoint was corrected to listen for `checkout.session.completed`.
- The external test order was marked `PAID`, active game access was granted, and a `purchase_confirmation` email was queued.

## Payment Maintenance

Admin payment operations now exist for common test and production-support cases:

- `Admin > Payment operations > Cancel stale pending`: marks `PENDING` orders older than 24 hours as `CANCELLED`.
- `Admin > Payment operations > Reconcile paid access`: reruns paid-order fulfillment and repairs missing `UserGameAccess` records.
- `Admin > Payment operations > Recover Stripe checkouts`: checks pending Stripe Checkout sessions older than 10 minutes against Stripe, marks completed paid sessions as `PAID`, grants access, and queues the purchase confirmation email. This is the recovery path for a missed or misconfigured webhook.
- `Admin > Payment operations > Queue alert`: queues a deduped email to `ADMIN_ALERT_EMAILS` when failed webhooks, stale pending orders, or recoverable Stripe checkouts need attention.
- `Admin > Orders > Order detail > Reconcile access`: reruns fulfillment for one paid order.

These operations are idempotent and audit logged. They are intended for abandoned Stripe Checkout sessions and webhook/fulfillment recovery, not refunds.

Checkout/session failures are marked on the local `Order` as `FAILED`. Stripe webhook processing failures are marked on `PaymentWebhookEvent` as `FAILED`. Both paths emit structured payment logs to the app server output without printing Stripe keys or webhook secrets.

For live testing, set `ADMIN_ALERT_EMAILS` to one or more operations inboxes and keep `EMAIL_PROVIDER` configured so payment-risk alerts can leave the outbound queue.

## Production Notes

- Stay in Stripe test mode until the full purchase, webhook, fulfillment, refund, and support process is tested.
- Before production, replace test keys with live keys in the production secret environment only.
- Keep webhook signature verification enabled.
- Do not use real card numbers in test mode.
- Add refund/reconciliation tooling before accepting live payments at scale.
