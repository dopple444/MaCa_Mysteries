# Account Recovery Procedures

Last updated: 2026-05-26

This document describes the safe operating procedure for account recovery before MaCa Mysteries is public.

## Current Implementation

- Signup creates a host account, signs the user in, and queues an email verification message.
- Email verification uses a signed link and stores `User.emailVerifiedAt`.
- Password reset requests queue a signed one-hour reset link if the account exists.
- Password reset changes the password, marks existing sessions revoked, clears login lockout state, writes an audit event, and signs the user in with the new password.
- Reset and verification emails are queued as `OutboundMessage` records and delivered through the configured email provider.
- Admin/support account recovery cases are tracked in `AccountRecoveryCase`.
- `/admin/account-recovery` lets support-capable admins create cases, link support tickets, record identity review status, queue password reset or email verification messages, review recovery risk counts, and queue deduped risk alerts.
- Password reset emails from account recovery require the case to be marked `VERIFIED` first.
- Recovery actions are audit logged with `accountRecovery.*` actions and never expose signed recovery links in admin UI.

## Customer Self-Service

1. Customer opens `/forgot-password`.
2. Customer enters their account email.
3. The app always shows the same success message to avoid exposing whether an account exists.
4. If the account exists, an `account_password_reset` email is queued.
5. Admin can run pending email delivery from Admin > Outbound messages if automatic delivery is not enabled yet.
6. Customer opens the reset link and chooses a new password.

## Support Procedure

When a customer reports account access trouble:

1. Confirm the support ticket came from the same email address as the account or ask the customer to create a new ticket from the account email.
2. Do not ask for or store the customer password.
3. Do not manually set a password for the customer.
4. Direct the customer to `/forgot-password`.
5. Open `/admin/account-recovery`.
6. Create an account recovery case with the customer account email and, when available, the support ticket ID.
7. If a support ticket is linked, the account email must match the ticket email.
8. Record identity verification as `VERIFIED` only after the support procedure confirms the request is legitimate.
9. Queue a password reset email or email verification message from the recovery case.
10. Check Admin > Outbound messages for pending or failed recovery emails.
11. If the message failed, correct the email provider issue and retry the message.
12. Close the case when the customer regains access or the request is denied/escalated.

## Admin Procedure

The admin account recovery view now includes:

- User lookup by email.
- Email verification status.
- Active session metadata, order, party, and support-ticket account counts.
- Recovery case creation and support-ticket linking.
- Identity verification state.
- Active, stale, pending-ID, recent-action, repeated-email, and failed-ID recovery report counts.
- Deduped account recovery risk alert queueing to `ADMIN_ALERT_EMAILS`.
- Guarded resend verification/reset actions.
- Audit log entries for recovery actions.

Use `/admin/users` for super-admin session revocation when a compromised session is suspected.

## Security Rules

- Never reveal whether an email address exists in public reset flows.
- Never send reset links to a different email address than the account email.
- Never paste reset links into support tickets or chat.
- Support/admin tools may queue reset emails, but must not display, copy, or store raw reset links.
- Password reset emails from recovery cases require the case to be marked verified first.
- Account recovery cases linked to support tickets must use the same email address as the ticket.
- Reset links expire after one hour.
- Reset links become invalid after the password changes.
- Production must set `ACCOUNT_TOKEN_SECRET` to a long random secret.
- Rotate `ACCOUNT_TOKEN_SECRET` if reset links are suspected to be exposed. Rotation invalidates outstanding verification/reset links.

## Go-Live Checklist

- Set `ACCOUNT_TOKEN_SECRET` in production.
- Verify `APP_URL` points to the production HTTPS origin.
- Verify Resend sender/domain configuration.
- Test signup verification with a real inbox.
- Test password reset with a real inbox.
- Confirm failed outbound messages are visible and retryable from admin.
- Confirm `/admin/account-recovery` is visible only to support-capable admin roles.
- Confirm super-admin session revocation remains available through `/admin/users` and retains revocation metadata.
- Run an account recovery drill with a support ticket, verified case, queued reset email, and closed case.
- Confirm the recovery report counts update for open, actioned, stale, closed, and denied cases.
- Confirm repeated-email and failed-ID counts update, then queue a risk alert when thresholds are crossed.
