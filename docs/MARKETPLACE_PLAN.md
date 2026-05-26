# Future Creator Marketplace Plan

Last updated: 2026-05-19

The creator marketplace is intentionally later than the first-party MVP. Do not let marketplace scope delay selling and running Burnett Games / MaCa Mysteries first-party games.

The creator builder should not become a separate permanent system. Certified creators should eventually use gated `/creator` routes in this app, backed by the same game versioning, builder, preview, publish-readiness, and conditional reveal services used for first-party games. External AI authoring tools may exist later, but they should import structured draft content into this app rather than becoming a second source of truth.

## Marketplace Readiness Prerequisites

- First-party catalog, purchase, hosting, guest join, character assignment, rounds, evidence, accusations, and final reveal are stable.
- Admin content editor supports versioning and spoiler validation.
- Payment, email, support, audit logs, object storage, and backups are production-ready.
- Content review workflow is documented and repeatable.
- Game Package import schema exists for AI-assisted drafts and runs through platform validation.
- Certified creator access controls exist and hide creator dashboards from uncertified users.

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
2. Admin certifies/approves creator account.
3. Certified creator opens the gated creator dashboard.
4. Creator drafts game content in the shared builder or imports an AI-assisted Game Package into a draft.
5. Creator submits a version for review.
6. Admin reviews content, spoilers, media, conditional rules, IP/copyright risk, and policy.
7. Creator revises if needed.
8. Admin approves publishing.
9. Marketplace product is activated.
10. Sales, refunds, revenue split, and payout tracking begin.

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
- Certified creator dashboard.
- AI-assisted Game Package imports.
- Public creator storefronts.
- Creator self-publishing.
- Marketplace reviews.
- Payouts.
- Revenue splits.

Revisit after first-party games can be purchased, hosted, completed, supported, and backed up end to end.
