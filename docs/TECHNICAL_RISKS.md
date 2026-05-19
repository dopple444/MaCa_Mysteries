# Technical Risks

Last inspected: 2026-05-19

## Summary

The app has moved from scaffold to self-hosted MVP foundation. The highest remaining risks are production auth/account recovery, real provider operations, spoiler leakage, content-editing complexity, media safety, deployment discipline, and future marketplace scale.

## Base44 Lock-In

Current risk:

- No Base44 dependencies were found in this workspace.
- The original Base44-generated code may still exist in another repository/export and may include behavior not represented here.

Mitigation:

- Preserve any original Base44 export.
- Run the Base44 dependency search against the original repository if it differs from this workspace.
- Treat this app as the self-hosted target foundation, not proof that every original behavior has already been migrated.

## Backend Ownership

Current risk:

- Backend behavior exists through Next Server Actions, route handlers, Prisma services, and app pages.
- As features grow, logic can become scattered if services are not kept clean.

Mitigation:

- Keep domain logic in `app/lib/*` services.
- Keep pages focused on rendering and route handlers focused on authorization/request handling.
- Add background worker boundaries later for email/SMS delivery, media processing, reminders, and payment reconciliation.

## Authentication And Account Recovery

Current risk:

- Custom auth has sessions, password hashing, HTTP-only cookies, CSRF, and rate limiting.
- It still lacks email verification, password reset, account recovery, session revocation, account lockout policy, and OAuth.

Mitigation:

- Add email verification and password reset before public launch.
- Add session metadata and revocation tools.
- Audit sensitive account events.
- Consider Auth.js or another established auth library if OAuth/social login becomes important.

## Payment Integration

Current risk:

- Products, orders, order items, entitlements, Stripe checkout creation, signed Stripe webhooks, idempotent webhook storage, and order fulfillment now exist.
- Real payment launch still depends on Stripe test credentials, dashboard configuration, webhook endpoint setup, taxes/refunds policy, and operational monitoring.

Mitigation:

- Run Stripe test mode end to end before selling.
- Keep provider IDs isolated in payment services.
- Add admin views for failed webhooks and pending orders.
- Add reconciliation for paid provider sessions that did not fulfill locally.

## Email And SMS

Current risk:

- Outbound messages can be queued, marked sent/failed, and retried.
- No real email/SMS provider delivery adapter is enabled yet.
- SMS opt-in preferences exist, but phone verification and STOP/START compliance are not implemented.

Mitigation:

- Choose email provider first and implement delivery for invitations, purchases, support, and account recovery.
- Choose SMS provider later and implement phone verification, opt-in history, STOP/START handling, and per-message audit.
- Add outbound throttling and failure monitoring before enabling production sends.

## File And Media Storage

Current risk:

- Seeded media metadata and upload validation helpers exist.
- Upload endpoints, object storage writes, signed URLs, private media paths, malware scanning, and admin review are not implemented yet.

Mitigation:

- Use S3-compatible object storage for binaries.
- Store metadata and visibility rules in PostgreSQL.
- Generate signed URLs or proxy content through access checks.
- Add asset size/type validation, malware scanning plan, and review workflow.

## Spoiler Leakage

Current risk:

- Server-side visibility helpers protect player cards, evidence, media, accusations, victim reveal, and final reveal content.
- Admin views expose full spoiler content.
- Host spoiler mode is not yet a distinct unlock flow beyond reveal controls.

Mitigation:

- Keep public/player responses projected and spoiler-safe.
- Add explicit host spoiler unlock flow with audit logging.
- Add content review checklist and validation rules for victim/killer/final solution references.
- Avoid logging spoiler body text.

## Data Model Complexity

Current risk:

- The schema now covers game versions, characters, rounds, cards, evidence, media, final reveal, parties, assignments, round state, reveals, accusations, results, commerce, support, outbound messages, webhooks, audit logs, and rate limits.
- Full content editors are still shallow.
- Changing game content after parties start can create versioning and compatibility issues.

Mitigation:

- Keep parties pinned to `gameVersionId`.
- Treat published versions as immutable.
- Add validation before publishing game versions.
- Keep required/optional character and clue redundancy rules explicit.

## Scaling To Marketplace

Current risk:

- Marketplace tables and flows are intentionally not in the MVP.
- Marketplace will require creator accounts, publishing approvals, revenue shares, reviews, moderation, tax/payout handling, and dispute support.

Mitigation:

- Keep first-party content stable first.
- Add creator ownership/source fields only when marketplace work starts.
- Preserve publishing/versioning rules that can later support creator approvals.

## Mobile Usability

Current risk:

- Screens are responsive at a basic Tailwind level.
- Live murder mystery gameplay will happen on phones, often during busy social events.

Mitigation:

- Test join/play/cards/evidence/media/accusation/reveal flows on real phone widths.
- Keep player UI fast to scan and easy to tap.
- Keep host controls optimized for tablet/laptop while acceptable on mobile.

## Deployment And Security

Current risk:

- Docker production scaffolding exists, but the current server still runs directly on Ubuntu.
- Production secret management, backup automation, reverse proxy/TLS, monitoring, and process supervision are not complete.
- The working tree contains a large uncommitted platform slice.

Mitigation:

- Commit the current slice when ready.
- Keep the direct dev server on `192.168.2.45:3001` until Docker cutover is intentionally tested.
- Add backups, restore drills, TLS/reverse proxy, firewall rules, and health checks.
- Run `npx prisma migrate deploy`, `npm test`, `npm run build`, and live tests before production changes.

## Authorization Gaps

Current state:

- Host identity is derived from authenticated sessions.
- Party mutation routes verify ownership.
- Admin routes require `ADMIN`.
- Player routes use guest cookies and server-side visibility filters.

Remaining risk:

- Admin is still a single broad role.
- Support, content, finance, and super-admin permissions should be split before staff or contractors use the system.

Mitigation:

- Add role-specific admin permissions.
- Continue authorization tests for every new mutation route.
- Keep audit logging on sensitive admin actions.

## Operational Support

Current state:

- Support ticket intake, support detail pages, support status controls, admin inventory, audit log, order detail pages, webhook records, and outbound retry controls exist.

Remaining risk:

- No threaded support replies, internal notes, email-linked replies, or SLA/status history model exists yet.

Mitigation:

- Add support message/history table.
- Send replies through the selected email provider.
- Add internal notes and status history before customer support volume grows.
