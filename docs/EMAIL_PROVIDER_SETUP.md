# Email Provider Setup

Last updated: 2026-05-21

Queued email delivery is now wired for two provider modes:

- `console`: local dry-run delivery that marks pending email messages as sent and writes a structured log.
- `resend`: HTTP delivery through the Resend Email API when credentials and a verified sender are configured.

Official references:

- Resend API introduction: https://resend.com/docs/api-reference/introduction
- Resend send email API: https://resend.com/docs/api-reference/emails

## Local Dry Run

Use console mode while developing templates and invitation flows:

```text
EMAIL_PROVIDER="console"
```

From Admin > Outbound messages, use `Send pending email`. Pending email rows are marked `SENT` with provider `console`.

## Resend Setup

When ready to test real email delivery:

1. Create or sign in to a Resend account.
2. Verify a sending domain or use a verified test sender.
3. Create an API key.
4. Set local environment values:

```text
EMAIL_PROVIDER="resend"
EMAIL_API_KEY="re_..."
EMAIL_FROM="MaCa Mysteries <hello@your-domain.example>"
```

Do not commit real API keys.

## Go-Live Reminder

Before production launch, review this setup again and replace any temporary Gmail sender with a verified `MaCaMysteries.com` sender/domain.

Go-live checklist:

- Verify the production sending domain in Resend.
- Change `EMAIL_FROM` to a branded sender, such as `MaCa Mysteries <hello@macamysteries.com>`.
- Send test invitations, purchase confirmations, account recovery emails, and support emails to multiple inbox providers.
- Confirm bounce/spam-complaint handling before high-volume sends.
- Rotate any test API keys and store live keys only in the production secret environment.

## Delivery Behavior

- Delivery reads `OutboundMessage` rows with `channel=EMAIL` and `status=PENDING`.
- Successful sends are marked `SENT`, store the provider message ID, and set `sentAt`.
- Provider failures are marked `FAILED` with the error text.
- Admin retry can move a failed message back to `PENDING`.
- Resend requests include an idempotency key based on the local message ID to reduce duplicate sends.

## Next Email Work

- Polish production email templates for invitations, purchase confirmations, support notices, verification, and password reset.
- Add support reply history before real support replies are enabled.
- Add provider webhooks later for delivered/bounced/spam complaint events.
