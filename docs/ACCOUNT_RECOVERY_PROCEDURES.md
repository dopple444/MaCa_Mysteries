# Account Recovery Procedures

Last updated: 2026-05-21

This document describes the safe operating procedure for account recovery before MaCa Mysteries is public.

## Current Implementation

- Signup creates a host account, signs the user in, and queues an email verification message.
- Email verification uses a signed link and stores `User.emailVerifiedAt`.
- Password reset requests queue a signed one-hour reset link if the account exists.
- Password reset changes the password, revokes existing sessions for that user, writes an audit event, and signs the user in with the new password.
- Reset and verification emails are queued as `OutboundMessage` records and delivered through the configured email provider.

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
5. Check Admin > Outbound messages for a pending or failed password reset email.
6. If the message failed, correct the email provider issue and retry the message.
7. If the customer still cannot receive email, escalate to a super-admin-only manual identity review process. That process is not implemented yet.

## Admin Procedure

Before production, add an admin-only account recovery view with:

- User lookup by email.
- Email verification status.
- Session inventory and revocation.
- Recent password reset and verification email activity.
- Audit log entries for recovery actions.
- A guarded resend verification/reset action.

Until that exists, use self-service reset and outbound message retry only.

## Security Rules

- Never reveal whether an email address exists in public reset flows.
- Never send reset links to a different email address than the account email.
- Never paste reset links into support tickets or chat.
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
- Add admin session revocation before support staff handle real accounts.
