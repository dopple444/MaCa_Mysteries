# Technical Risks

Last inspected: 2026-05-22

## Summary

The app has moved from scaffold to self-hosted MVP foundation. The highest remaining risks are production auth policy, real provider operations, spoiler leakage, conditional-rule correctness, content-editing complexity, media safety, deployment discipline, and future marketplace scale.

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
- It has email verification and password reset foundations.
- Sign-in success/failure/rate-limit events, logout, account creation, email verification, password reset, role-change requests/approvals/denials, session revocations, and account recovery actions are audit logged and visible to the appropriate admin scopes.
- Support-gated account recovery cases now exist for ticket-linked identity review and safe reset/verification email queueing.
- It still lacks account lockout policy, richer session metadata, and OAuth.

Mitigation:

- Use `docs/ACCOUNT_RECOVERY_PROCEDURES.md` as the operating baseline and run a recovery drill before public launch.
- Add richer session metadata and keep super-admin revocation tools available for account recovery.
- Continue auditing sensitive account events and add alerting for high-risk login/recovery patterns.
- Consider Auth.js or another established auth library if OAuth/social login becomes important.

## Payment Integration

Current risk:

- Products, orders, order items, entitlements, Stripe checkout creation, signed Stripe webhooks, idempotent webhook storage, and order fulfillment now exist.
- Real payment launch still depends on Stripe test credentials, dashboard configuration, webhook endpoint setup, taxes/refunds policy, and operational monitoring.

Mitigation:

- Run Stripe test mode end to end before selling.
- Keep provider IDs isolated in payment services.
- Admin views now expose failed webhooks, pending orders, stale pending-order cleanup, paid access reconciliation, Stripe checkout recovery, and queued payment-risk alerts.
- Configure `ADMIN_ALERT_EMAILS` before public live testing so failed webhooks and stuck payment states can be escalated through outbound email.

## Email And SMS

Current risk:

- Outbound messages can be queued, marked sent/failed, and retried.
- Guest invitation state now reflects local sent/failed/retry markers, but provider delivery webhooks and bounce/complaint handling are not implemented.
- Email delivery adapters now support local console mode and Resend; no real SMS provider delivery adapter is enabled yet.
- SMS opt-in preferences exist, but phone verification and STOP/START compliance are not implemented.

Mitigation:

- Configure production email domain/API credentials and implement templates for invitations, purchases, support, and account recovery.
- Before go-live, replace the temporary Gmail sender with a verified `MaCaMysteries.com` sender/domain and retest deliverability.
- Choose SMS provider later and implement phone verification, opt-in history, STOP/START handling, and per-message audit.
- Add outbound throttling and failure monitoring before enabling production sends.
- Add provider delivery webhooks so invitation status reflects actual bounces, complaints, and delayed delivery after the initial send request.

## File And Media Storage

Current risk:

- Seeded media metadata, upload validation helpers, local admin upload endpoints, and conditional media visibility hooks exist.
- S3-compatible object storage writes, signed URLs, malware scanning, and admin review are not implemented yet.
- Advanced gameplay will increasingly depend on private media, locked documents, and digital artifacts, making storage authorization more important.

Mitigation:

- Use S3-compatible object storage for binaries.
- Store metadata and visibility rules in PostgreSQL.
- Generate signed URLs or proxy content through access checks.
- Add asset size/type validation, malware scanning plan, and review workflow.

## Spoiler Leakage

Current risk:

- Server-side visibility helpers protect player cards, evidence, media, accusations, victim reveal, and final reveal content.
- Conditional unlock checks now hide locked cards/evidence/media unless the current player has the required unlock event.
- Admin views expose full spoiler content.
- Host spoiler mode now has a distinct audited unlock flow, but needs continued QA as more content types are added.

Mitigation:

- Keep public/player responses projected and spoiler-safe.
- Keep explicit host spoiler unlock regression tests as the host view grows.
- Add content review checklist and validation rules for victim/killer/final solution references.
- Avoid logging spoiler body text.
- Keep conditional content filters centralized so new digital artifacts and tools do not bypass the same policy.

## Conditional Reveal Engine

Current risk:

- The foundation models and services exist for digital artifacts, character tools, unlock rules, code attempts, unlock events, asset views, player interactions, and player inventory.
- The first player-facing access-code unlock path is implemented and tested end to end for locked evidence, cards, media, and digital artifacts.
- Host party pages now show sanitized code-attempt and unlock-event activity without raw codes.
- Admin inventory now shows platform-wide code-attempt and unlock-event monitoring without stored code hashes, plus deduped suspicious-attempt alert queueing.
- Draft-only authoring screens now exist for digital artifacts, character tools, and unlock rules.
- Admin preview pages now simulate host-safe, spoiler-host, and selected-character projections.
- Publish-readiness validation now blocks missing essential content, orphan required unlock rules, unpublished required rules, unattached published rules, and access-code rules without generator tools.
- Deeper rule classes can still create bad authoring paths until asset-view, host-approval, reveal-state, multi-player interaction, circular dependency, and spoiler-wording validation is expanded.
- Successful code attempts and unlock events must remain consistent as concurrent gameplay increases.

Mitigation:

- Expand publish-readiness checks for circular dependencies, impossible round/character conditions, unsafe spoiler labels, and every trigger type beyond access-code rules.
- Add transaction-level guards around limited-use tools and repeated code attempts as gameplay traffic increases.
- Tune suspicious-attempt thresholds and add unusual retry pattern reporting on top of the admin/global monitoring view.
- Extend tests beyond access codes to asset-view, host-approval, round-state, reveal-state, and multi-player interaction rules.

## Data Model Complexity

Current risk:

- The schema now covers game versions, characters, rounds, cards, evidence, media, final reveal, parties, assignments, round state, reveals, accusations, results, commerce, support, outbound messages, webhooks, audit logs, rate limits, and conditional gameplay models.
- Full content editors are still shallow.
- Changing game content after parties start can create versioning and compatibility issues.
- Builder-ready abstractions can grow into a hard-to-maintain rules system without validation and preview tooling.

Mitigation:

- Keep parties pinned to `gameVersionId`.
- Treat published versions as immutable.
- Keep validation in the publish path before game versions can become playable.
- Keep required/optional character and clue redundancy rules explicit.
- Keep conditional rules tied to immutable game versions and party-scoped runtime events.

## Game Builder Complexity

Current risk:

- Admin editing exists for draft game metadata, characters, rounds, cards, evidence, and media metadata.
- The builder must eventually cover synopsis, themes, player counts, bios, private backgrounds, relationships, pre-game tasks, round cards, clues, evidence, media, fake messages, final reveal content, spoiler rules, tools, conditional unlocks, previews, and publish/version control.
- Building a large wizard too early could slow the MVP and create brittle UI around still-evolving rules.

Mitigation:

- Keep the next builder work admin-only and first-party focused.
- Keep the current small editors and preview pages admin-only until publish validation covers every trigger type.
- Build deeper publish-readiness checks before large visual wizard screens.
- Treat creator access as a permission layer over a proven internal builder, not as the first implementation.

## Scaling To Marketplace

Current risk:

- Marketplace tables and flows are intentionally not in the MVP.
- Marketplace will require creator accounts, publishing approvals, revenue shares, reviews, moderation, tax/payout handling, and dispute support.
- Creator-authored conditional mechanics will require stronger validation, preview, moderation, and support tooling than first-party-only content.

Mitigation:

- Keep first-party content stable first.
- Add creator ownership/source fields only when marketplace work starts.
- Preserve publishing/versioning rules that can later support creator approvals.
- Require the internal builder and conditional reveal engine to be stable before enabling outside creators.

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
- Production secret management, off-box backup scheduling, reverse proxy/TLS, monitoring, and process supervision are not complete.
- The working tree contains a large uncommitted platform slice.

Mitigation:

- Commit the current slice when ready.
- Keep the direct dev server on `192.168.2.45:3001` until Docker cutover is intentionally tested.
- Use `npm run backup:db` before risky migrations, then add scheduled off-box backups, restore drills, TLS/reverse proxy, firewall rules, and health checks.
- Run `npx prisma migrate deploy`, `npm test`, `npm run build`, and live tests before production changes.

## Authorization Gaps

Current state:

- Host identity is derived from authenticated sessions.
- Party mutation routes verify ownership.
- Admin routes require operational admin permissions. `ADMIN` and `SUPER_ADMIN` retain full access; `CONTENT_EDITOR`, `FINANCE`, and `SUPPORT` are scoped to content, payment, support, and outbound-message areas.
- Player routes use guest cookies and server-side visibility filters.

Remaining risk:

- Super-admin UI now exists for requesting/approving sensitive role changes, revoking sessions, searching/filtering accounts, and reviewing recent role/session audit history.
- Support-gated account recovery exists, but session metadata and lockout policy are still shallow.

Mitigation:

- Add broader login/security event monitoring, lockout rules, and session metadata.
- Continue authorization tests for every new mutation route.
- Keep audit logging on sensitive admin actions.

## Operational Support

Current state:

- Support ticket intake, support message history, support detail pages, queued customer replies, internal notes, support status controls, admin inventory, audit log, order detail pages, webhook records, and outbound retry controls exist.

Remaining risk:

- Reply delivery depends on the selected email provider and sender/domain configuration.
- There is no inbound email reply ingestion, assignment workflow, SLA timer, or status-history automation yet.

Mitigation:

- Complete production email sender/domain setup before relying on support replies.
- Add inbound email reply handling if support should work from an email inbox.
- Add assignments, SLA/status history, and escalation reporting before customer support volume grows.
