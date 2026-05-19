# Future Creator Marketplace Plan

Last updated: 2026-05-19

The creator marketplace is intentionally later than the first-party MVP. Do not let marketplace scope delay selling and running Burnett Games / MaCa Mysteries first-party games.

## Marketplace Readiness Prerequisites

- First-party catalog, purchase, hosting, guest join, character assignment, rounds, evidence, accusations, and final reveal are stable.
- Admin content editor supports versioning and spoiler validation.
- Payment, email, support, audit logs, object storage, and backups are production-ready.
- Content review workflow is documented and repeatable.

## Later Entities

- `creator_profiles`
- `creator_games`
- `creator_payouts`
- `creator_revenue_splits`
- `marketplace_reviews`
- `publishing_approvals`

These entities are already documented as later-stage concepts in `docs/DATABASE_MODEL_DRAFT.md`.

## Creator Workflow

1. Creator applies for a profile.
2. Admin approves creator account.
3. Creator drafts game content.
4. Creator submits a version for review.
5. Admin reviews content, spoilers, media, and policy.
6. Creator revises if needed.
7. Admin approves publishing.
8. Marketplace product is activated.
9. Sales, refunds, revenue split, and payout tracking begin.

## Marketplace Risks

- Spoiler leakage from creator-submitted content.
- Low-quality or unplaytested games.
- Copyright and IP ownership disputes.
- Refund and support complexity.
- Payout tax/compliance requirements.
- Review moderation and spoiler moderation.

## MVP Boundary

Keep these out of first-party MVP:

- Creator onboarding.
- Public creator storefronts.
- Creator self-publishing.
- Marketplace reviews.
- Payouts.
- Revenue splits.

Revisit after first-party games can be purchased, hosted, completed, supported, and backed up end to end.
