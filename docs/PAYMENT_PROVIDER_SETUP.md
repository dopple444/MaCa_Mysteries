# Payment Provider Setup

Last updated: 2026-05-21

The app is wired for Stripe Checkout as the first payment provider. Sandbox checkout has been tested successfully with Stripe-hosted payment collection, webhook forwarding, paid order fulfillment, and active game access.

Official references:

- Stripe Checkout Sessions API: https://docs.stripe.com/api/checkout/sessions/create
- Stripe webhooks: https://docs.stripe.com/webhooks
- Stripe CLI install: https://docs.stripe.com/stripe-cli/install
- Stripe test cards: https://docs.stripe.com/testing

## Current Local State

Local `.env` has been prepared with Stripe mode flags:

```text
APP_URL="http://192.168.2.45:3001"
PAYMENT_PROVIDER="stripe"
STRIPE_SECRET_KEY=""
STRIPE_WEBHOOK_SECRET=""
```

Secrets are intentionally omitted from this document. `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` are set locally if `npm run payment:check` reports them as set.

## Stripe Dashboard Setup

1. Create or sign in to a Stripe account.
2. Keep the dashboard in test mode while we are testing.
3. Open Developers > API keys.
4. Copy the test secret key.
5. Put it in `.env`:

```text
STRIPE_SECRET_KEY="sk_test_..."
```

Do not paste live keys into chat, commit them, or put them in `.env.example`.

## Local Webhook Setup

The local app webhook endpoint is:

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

Restart the local server after editing `.env`.

The current development listener runs in tmux session `maca-stripe-listener`.

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

## Restart Local App And Webhook Listener

Use this pair when the app cannot be reached or after `.env` payment changes:

```bash
tmux kill-session -t maca-mysteries 2>/dev/null || true
rm -rf .next
tmux new-session -d -s maca-mysteries
tmux send-keys -t maca-mysteries 'cd /home/dopple444/projects/MaCa_Mysteries && npm run dev -- -H 0.0.0.0 -p 3001' C-m
```

Restart the Stripe webhook listener:

```bash
tmux kill-session -t maca-stripe-listener 2>/dev/null || true
tmux new-session -d -s maca-stripe-listener
tmux send-keys -t maca-stripe-listener 'cd /home/dopple444/projects/MaCa_Mysteries && npm run stripe:listen' C-m
```

Then verify:

```bash
curl -I http://127.0.0.1:3001/games
tmux ls
```

## Test Checkout

1. Make sure the dev server is running at `http://192.168.2.45:3001`.
2. Make sure the Stripe CLI listener is running.
3. Sign in to the app.
4. Open a published game detail page.
5. Use `Purchase access`.
6. In Stripe Checkout test mode, use card number `4242 4242 4242 4242`, any valid future date, any CVC, and any postal code.
7. After payment, confirm:
   - Stripe redirects back to the app.
   - Admin order detail shows the order as paid.
   - Admin payment webhooks shows a processed `checkout.session.completed` event.
   - The account order/access page shows active game access.
   - The host can create a party for the purchased game.

Latest sandbox result:

- `checkout.session.completed` was received from Stripe.
- Webhook route returned `200`.
- Local order status changed to `PAID`.
- `UserGameAccess` was created for Murder at Hollow Lake.

## Payment Maintenance

Admin payment operations now exist for common test and production-support cases:

- `Admin > Payment operations > Cancel stale pending`: marks `PENDING` orders older than 24 hours as `CANCELLED`.
- `Admin > Payment operations > Reconcile paid access`: reruns paid-order fulfillment and repairs missing `UserGameAccess` records.
- `Admin > Orders > Order detail > Reconcile access`: reruns fulfillment for one paid order.

These operations are idempotent and audit logged. They are intended for abandoned Stripe Checkout sessions and webhook/fulfillment recovery, not refunds.

Checkout/session failures are marked on the local `Order` as `FAILED`. Stripe webhook processing failures are marked on `PaymentWebhookEvent` as `FAILED`. Both paths emit structured payment logs to the app server output without printing Stripe keys or webhook secrets.

## Production Notes

- Stay in Stripe test mode until the full purchase, webhook, fulfillment, refund, and support process is tested.
- Before production, replace test keys with live keys in the production secret environment only.
- Keep webhook signature verification enabled.
- Do not use real card numbers in test mode.
- Add refund/reconciliation tooling before accepting live payments at scale.
