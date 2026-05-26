# Route And Link Audit

Last inspected: 2026-05-22

## Summary

The app is currently reachable on the local dev server:

- `http://192.168.2.45:3001`
- `http://127.0.0.1:3001`

Latest live verification:

- `npx prisma format`, `npx prisma migrate deploy`, `npx prisma generate`, and `npm run test:prepare`: passed.
- `./node_modules/.bin/tsc --noEmit`: passed.
- `npm test`: passed, 76 tests total, 71 pass and 5 skipped when no `TEST_BASE_URL` is set.
- `npm run build`: passed.
- `TEST_BASE_URL=http://127.0.0.1:3001 npm test`: passed, 76 tests total, 76 pass and 0 skipped.
- Stripe sandbox checkout completed on 2026-05-21: webhook returned `200`, order became `PAID`, and active game access was granted.
- Admin payment maintenance now supports stale pending-order cancellation and paid access reconciliation.
- Payment checkout and webhook processing now emit structured logs and mark failed records explicitly.
- A dedicated local test database, `maca_mysteries_test`, is prepared and used by standard `npm test`.
- Admin outbound email delivery now supports console dry-run and Resend-backed delivery for pending email messages.
- Account email verification and password reset pages/actions now exist and queue signed-link emails.
- Draft-only admin character, round, card, evidence, and media metadata editing is wired through `/admin/games/[gameId]`.
- Local admin media uploads are wired through `/admin/media/uploads`.
- Host spoiler mode unlock is explicit, stored on the party, and audit logged.
- Guest invitation delivery state is tracked on guest records and updated from outbound email sent/failed/retry markers.
- Join and player pages have a first mobile/accessibility pass with tighter spacing, explicit form labels, full-width mobile actions, and safer media sizing.
- Support tickets now have message history, queued customer replies, internal notes, and audited admin reply/note actions.
- Game Builder Wizard and Conditional Reveal Engine foundations now exist for digital artifacts, character tools, unlock rules, party tool instances, code attempts, unlock events, asset views, player interactions, and player inventory.
- Player-safe card/evidence/media helpers now honor conditional unlock rules while preserving round, assignment, reveal, and host spoiler-safe behavior.
- Admin game detail now has draft-only editors and audited routes for digital artifacts, character tools, and unlock rules.
- Admin builder preview now supports host-safe, spoiler-host, and selected-character projections with round progress and simulated unlock rules.
- Publish-readiness validation now blocks publishing versions with missing essential content or unsafe conditional unlock wiring.
- Player character tools and locked evidence/card/media/artifact code entry now exist on `/play`, backed by `POST /play/unlock`.
- Host party control now shows sanitized conditional unlock activity.

## Current Server State

- The previous process on port `3001` was stopped.
- The current dev server is running in detached tmux session `maca-mysteries`.
- The Stripe webhook listener is running in detached tmux session `maca-stripe-listener`.
- The tmux command is `npm run dev -- -H 0.0.0.0 -p 3001`.
- Next reported ready on port `3001`, and `/games` returned `200 OK` on both `127.0.0.1` and `192.168.2.45`.

## Verified Routes

| Route | Result | Notes |
| --- | --- | --- |
| `/` | `200 OK` | Public home page renders. |
| `/host` | `200 OK` | Public host information page renders. |
| `/join` | `200 OK` | Guest join form renders. |
| `/support` | `200 OK` | Support ticket form renders. |
| `/games` | `200 OK` | Public database-backed catalog renders. |
| `/games/the-last-curtain` | Covered by live tests | Game detail route renders when seeded. |
| `/games/murder-at-hollow-lake` | Covered by live tests | Game detail route renders when seeded. |
| `/games/not-a-real-game` | Covered by live tests | Expected `404 Not Found`. |
| `/login` | Covered by live tests | Login page renders and auth flow is exercised. |
| `/signup` | Covered by live tests | Signup page renders and auth flow is exercised. |
| `/dashboard` | `307 Temporary Redirect` unauthenticated | Expected redirect to `/login`; authenticated dashboard covered by live tests. |
| `/account/orders` | Auth-gated | Expected redirect to `/login` when unauthenticated. |
| `/account/notifications` | `307 Temporary Redirect` unauthenticated | Expected redirect to `/login`. |
| `/admin` | `307 Temporary Redirect` unauthenticated | Expected redirect to `/login`; admin access covered by live tests. |
| `/api/health` | `200 OK` | Returns JSON status and timestamp. |
| `/api/games` | `200 OK` | Returns public-safe database-backed JSON game list. |

## Link Inventory

| Source | Link target | Status | Notes |
| --- | --- | --- | --- |
| `app/layout.tsx` | `/` | OK | Header brand link. |
| `app/layout.tsx` | `/host` | OK | Public host page. |
| `app/layout.tsx` | `/join` | OK | Guest join form. |
| `app/layout.tsx` | `/games` | OK | Catalog page. |
| `app/page.tsx` | `/host` | OK | Public host CTA. |
| `app/page.tsx` | `/join` | OK | Public guest join CTA. |
| `app/host/page.tsx` | `/games` | OK | Catalog CTA. |
| `app/host/page.tsx` | `/join` | OK | Join CTA. |
| `app/games/page.tsx` | `/games/[slug]` | OK | Dynamic game detail route. |
| `app/games/[slug]/page.tsx` | `/checkout/start` | OK, auth-gated | Purchase form redirects unauthenticated users to `/login`; creates pending orders when authenticated and no entitlement exists. |
| `app/games/[slug]/page.tsx` | `/host/create?game=slug` | OK, auth-gated | Start-party link redirects unauthenticated users to `/login`. |
| `app/login/page.tsx` | `/signup` | OK | Signup page renders. |
| `app/signup/page.tsx` | `/login` | OK | Login page renders. |
| `app/login/page.tsx` | `/forgot-password` | OK | Password reset request page renders. |
| `app/dashboard/page.tsx` | `/host` | OK, auth-gated | Dashboard requires auth first. |
| `app/dashboard/page.tsx` | `/games` | OK, auth-gated | Dashboard requires auth first. |
| `app/dashboard/page.tsx` | `/account/notifications` | OK, auth-gated | Notification settings require auth. |
| `app/dashboard/page.tsx` | `/account/orders` | OK, auth-gated | Order/access history requires auth. |
| `app/host/party/[partyId]/page.tsx` | `/join?code=INVITECODE` | OK | Join page pre-fills code and backend join flow is implemented. |
| `app/admin/page.tsx` | `/admin/games/new` | OK, admin-gated | Draft game creation form. |
| `app/admin/page.tsx` | `/admin/games/[gameId]` | OK, admin-gated | Game detail/admin content editing and builder editing. |
| `app/admin/games/[gameId]/page.tsx` | `/admin/games/[gameId]/versions/[versionId]/preview` | OK, admin-gated | Builder visibility preview for each version. |
| `app/admin/page.tsx` | `/admin/orders/[orderId]` | OK, admin-gated | Order detail. |
| `app/admin/page.tsx` | `/admin/support/[ticketId]` | OK, admin-gated | Support ticket detail. |

## Action/Form Status

| Form/action | Current status | Notes |
| --- | --- | --- |
| Login | Implemented | Uses Prisma, rate limiting, CSRF, password hash verification, and session creation. |
| Signup | Implemented | Uses Prisma, rate limiting, CSRF, password hashing, and session creation. |
| Email verification | Implemented foundation | Signup queues a signed verification email; authenticated users can resend; confirm route marks `emailVerifiedAt`. |
| Password reset | Implemented foundation | Reset requests queue signed one-hour links; reset revokes existing sessions and creates a new session. |
| Logout | Implemented | Requires CSRF and clears the session. |
| Notification settings | Implemented | Saves email/SMS preferences and phone number. |
| Create party | Implemented | Requires auth, game access check, CSRF, published game/version, guest parsing, round/final reveal initialization, invitation queueing, and guest invitation-state updates. |
| Add/approve guest | Implemented | Requires party ownership, CSRF, and non-completed party. |
| Join party | Implemented | Supports invited guests, pending approval for unknown emails, rate limiting, CSRF, and guest cookie. |
| Invitation resend | Implemented foundation | Host resend queues a new invitation, increments guest resend count, clears stale failure detail, and records audit activity. |
| Character assignment | Implemented | Supports assign, replace, and clear with uniqueness rules and audit logs. |
| Round controls | Implemented | Supports unlock/start/complete with audit logs and completed-party blocking. |
| Evidence controls | Implemented | Supports reveal/hide with audit logs and player-safe visibility. |
| Final reveal controls | Implemented | Supports victim reveal and solution reveal with round gates and audit logs. |
| Host spoiler mode | Implemented foundation | Host view is spoiler-safe by default and requires an audited explicit unlock before showing protected host spoilers. |
| Accusation form | Implemented | Player accusation create/update is guarded by guest cookie, round state, CSRF, and completed-party blocking. |
| Player code unlock | Implemented foundation | Player locked evidence/card/media/artifact code entry is guarded by guest cookie, assignment, target availability, CSRF, guest-scoped rate limiting, hashed code checks, and party unlock events. |
| Host conditional activity | Implemented foundation | Host party page shows sanitized unlock events and code attempts without raw codes or spoiler-sensitive labels unless host spoiler mode is unlocked. |
| Party completion/reopen | Implemented | Creates/removes `PartyResult` and blocks/re-enables runtime mutations. |
| Checkout start | Implemented foundation | Creates pending orders and redirects to Stripe when credentials exist; otherwise returns provider-not-configured. |
| Stripe webhook | Implemented foundation | Verifies signature, records event IDs idempotently, marks paid orders, grants game access, and marks processing failures. |
| Admin payment maintenance | Implemented | Admin-only CSRF forms cancel stale pending orders and reconcile paid game access in bulk or per order. |
| Admin outbound delivery | Implemented foundation | Admin-only CSRF form sends pending email through console or Resend provider configuration. |
| Support ticket | Implemented | Public/account support intake with rate limiting, CSRF, and initial message history creation. |
| Admin support replies/notes | Implemented foundation | Admin-only route queues customer reply emails, stores internal notes, and audits both actions. |
| Admin status/edit forms | Implemented | Admin-only game metadata, draft-only character/round/card/evidence/media/builder metadata editing, version status, support status, and outbound retry controls. |
| Admin builder artifact/tool/rule forms | Implemented foundation | Draft-only digital artifacts, character tools, and unlock rules save through audited admin routes with linkage validation. |
| Admin builder preview | Implemented foundation | Admin-only page previews visible cards, evidence, media, artifacts, and tools by host/player mode, round progress, and simulated unlocks. |
| Publish-readiness validation | Implemented foundation | Admin game detail shows readiness errors/warnings and publish attempts are blocked when required content or conditional unlock wiring is unsafe. |
| Admin media uploads | Implemented local foundation | Admin-only CSRF upload form validates MIME/size and writes public local media under `/uploads/media/...`; private local files stay outside `public/`. |
| Admin account recovery | Implemented foundation | Support-gated account recovery cases link matching support tickets, track identity review, queue safe recovery emails, and audit actions. |

## Remaining Link/Route Work

1. Add deeper admin editors for final reveal content.
2. Add S3-compatible upload writes and signed private media URLs.
3. Expand publish-readiness validation for circular dependencies, spoiler wording, and non-code trigger types.
4. Add invite reminder scheduling after email operations settle.
5. Add session rotation and risk-scored account-security alerts.
6. Add creator routes later, after the first-party builder, conditional engine, and first-party MVP are stable.
