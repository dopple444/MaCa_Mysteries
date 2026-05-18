# Technical Risks

Last inspected: 2026-05-17

## Summary

The current app is a promising self-hosted scaffold, but it is not yet a complete platform. The highest risks are spoiler leakage, incomplete domain modeling, auth/payment hardening, and operational readiness.

## Base44 Lock-In

Current risk:

- No Base44 dependencies were found in this workspace.
- The original Base44-generated code may still exist in another repository/export and may include behavior not represented here.

Impact:

- Hidden functionality may be lost if the current scaffold is treated as complete.
- Entity names, workflows, and generated backend functions from Base44 may not be mapped.

Mitigation:

- Preserve any original Base44 export.
- Run the Base44 dependency search against the original repository.
- Treat this scaffold as the self-hosted target foundation, not proof that the original migration is complete.

## Missing Backend Ownership

Current risk:

- The app has some backend code through Next Server Actions and Prisma, but no complete backend service architecture yet.
- Game catalog now has basic database-backed records, but no full gameplay/content model yet.

Impact:

- Business logic can become scattered across pages.
- API clients, webhooks, jobs, and future mobile clients may be hard to support.

Mitigation:

- Create domain services under `app/lib/services`.
- Keep pages thin.
- Use route handlers for workflows needed outside form submissions.

## Authentication Migration

Current risk:

- Custom auth exists, but it is minimal.
- No password reset, email verification, account lockout, rate limiting, OAuth, or full session management.

Impact:

- Account compromise risk.
- Poor customer recovery/support experience.
- Production launch blocked until auth is hardened.

Mitigation:

- Add email verification and password reset.
- Add rate limiting to login/signup.
- Track session metadata and revocation.
- Audit sensitive events.
- Consider Auth.js or another established auth library if OAuth becomes important.

## Payment Integration

Current risk:

- No payment provider, products, orders, order items, or entitlements exist.

Impact:

- Hosts can create parties without purchase checks once routes exist unless guarded.
- Revenue flow is not ready.
- Refunds, taxes, and webhook idempotency can become late surprises.

Mitigation:

- Add `products`, `orders`, `order_items`, and `game_entitlements`.
- Make party creation check entitlement.
- Use verified, idempotent payment webhooks.
- Keep payment provider-specific IDs isolated in commerce services.

## File And Media Storage

Current risk:

- No media storage exists.
- Future games require images, audio, video, fake documents, and message-style clues.

Impact:

- Storing media on the app filesystem can fail in production or during redeploys.
- Media URLs can leak spoiler-protected content.
- Large files can increase server cost and backup complexity.

Mitigation:

- Use object storage for binaries.
- Store metadata and visibility rules in PostgreSQL.
- Generate signed URLs or proxy content through access checks.
- Add asset size/type validation.

## Spoiler Leakage

Current risk:

- No spoiler model exists yet.
- Host-safe mode is described in UI copy but not enforced by a backend content policy.

Impact:

- Killer, victim, or solution content could leak through UI, API payloads, logs, admin previews, or media URLs.
- A spoiled host/player experience damages the core product.

Mitigation:

- Add explicit visibility classifications.
- Enforce access server-side.
- Return projected views instead of raw game records.
- Add tests for victim/killer/final reveal visibility.
- Audit spoiler unlock actions.

## Data Model Complexity

Current risk:

- The current schema only covers users, sessions, parties, and guests.
- Murder mystery content needs versioned games, characters, rounds, cards, clues, evidence, media, messages, accusations, and results.

Impact:

- If modeled casually, changes will break live parties.
- Optional characters can accidentally hold required clues.
- Game edits can mutate already purchased or started parties.

Mitigation:

- Version game content.
- Reference `game_version_id` from every party.
- Validate game versions before publishing.
- Keep required/optional character and clue redundancy rules explicit.

## Scaling To Marketplace

Current risk:

- Marketplace entities are not present.
- Marketplace requirements include creator accounts, publishing approvals, revenue shares, reviews, moderation, and payouts.

Impact:

- Building marketplace too early will slow first-party MVP.
- Building first-party content without future boundaries can make marketplace hard later.

Mitigation:

- Keep `games` ownership source explicit.
- Add creator tables later.
- Build publishing/versioning in a way that works for first-party now and creator approval later.

## Mobile Usability

Current risk:

- Screens are responsive at a basic Tailwind level, but player gameplay has not been built.
- Murder mystery gameplay will likely happen on phones during live parties.

Impact:

- Small-screen readability and tap targets can make or break the player experience.
- Dense clues, media, and round cards may be hard to scan.

Mitigation:

- Design player screens mobile-first.
- Test guest join, cards, evidence, and accusations on real phone widths.
- Keep host controls usable on tablets/laptops and acceptable on mobile.

## Deployment And Security

Current risk:

- No Docker or production deployment files in this workspace.
- No production secret management, backups, monitoring, or reverse proxy config.
- `.git` is currently not a usable repository in this workspace.

Impact:

- Hard to reproduce deployments.
- Data loss risk without backups.
- Security misconfiguration risk.
- Hard to collaborate or roll back changes without Git health.

Mitigation:

- Restore/clone a real Git repository.
- Add Docker and production deployment docs in a later phase.
- Add database backups and restore drills.
- Add TLS/reverse proxy plan.
- Add monitoring and health checks.

## Authorization Gaps

Current state:

- `/host/create` no longer posts `hostId`.
- `createParty()` derives host identity from the authenticated session.
- `addGuest()` verifies the current user owns the party.

Impact:

- Remaining authorization risk will grow as more party controls, player views, round state, and admin tools are added.

Mitigation:

- Continue deriving host identity from `requireUser()`, not hidden form fields.
- Continue verifying party ownership server-side on every party mutation.
- Add authorization tests.

## Catalog Data Model

Current state:

- Public catalog reads are centralized through `app/lib/games.ts`.
- The source of truth is PostgreSQL `Game`, `GameVersion`, and `Product` records.

Impact:

- Catalog records currently cover only public metadata.
- Spoiler-protected content, media, characters, rounds, cards, and game editor workflows still need separate models.

Mitigation:

- Keep public catalog reads database-backed.
- Add the full gameplay/content model incrementally, with spoiler-safe read services.

## Operational Support

Current risk:

- No support tickets, admin tools, audit log, or operational dashboards exist.

Impact:

- Customer issues around purchases, party access, and spoilers will be hard to resolve.

Mitigation:

- Add support ticket model.
- Add audit log for sensitive events.
- Build minimal admin views after core gameplay works.
