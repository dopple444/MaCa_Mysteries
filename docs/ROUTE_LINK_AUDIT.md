# Route And Link Audit

Last inspected: 2026-05-19

## Summary

The app is currently reachable on the local dev server:

- `http://192.168.2.45:3001`
- `http://127.0.0.1:3001`

Latest live verification:

- `npx prisma format && npx prisma migrate deploy && npx prisma generate`: passed.
- `./node_modules/.bin/tsc --noEmit`: passed.
- `npm test`: passed, 38 tests total, 33 pass and 5 skipped when no `TEST_BASE_URL` is set.
- `npm run build`: passed.
- `TEST_BASE_URL=http://127.0.0.1:3001 npm test`: passed, 38 tests total, 38 pass, 0 skipped.

## Current Server State

- The previous process on port `3001` was stopped.
- The current dev server is running in detached tmux session `maca-mysteries`.
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
| `app/dashboard/page.tsx` | `/host` | OK, auth-gated | Dashboard requires auth first. |
| `app/dashboard/page.tsx` | `/games` | OK, auth-gated | Dashboard requires auth first. |
| `app/dashboard/page.tsx` | `/account/notifications` | OK, auth-gated | Notification settings require auth. |
| `app/dashboard/page.tsx` | `/account/orders` | OK, auth-gated | Order/access history requires auth. |
| `app/host/party/[partyId]/page.tsx` | `/join?code=INVITECODE` | OK | Join page pre-fills code and backend join flow is implemented. |
| `app/admin/page.tsx` | `/admin/games/new` | OK, admin-gated | Draft game creation form. |
| `app/admin/page.tsx` | `/admin/games/[gameId]` | OK, admin-gated | Game detail/admin content inspection. |
| `app/admin/page.tsx` | `/admin/orders/[orderId]` | OK, admin-gated | Order detail. |
| `app/admin/page.tsx` | `/admin/support/[ticketId]` | OK, admin-gated | Support ticket detail. |

## Action/Form Status

| Form/action | Current status | Notes |
| --- | --- | --- |
| Login | Implemented | Uses Prisma, rate limiting, CSRF, password hash verification, and session creation. |
| Signup | Implemented | Uses Prisma, rate limiting, CSRF, password hashing, and session creation. |
| Logout | Implemented | Requires CSRF and clears the session. |
| Notification settings | Implemented | Saves email/SMS preferences and phone number. |
| Create party | Implemented | Requires auth, game access check, CSRF, published game/version, guest parsing, round/final reveal initialization, and invitation queueing. |
| Add/approve guest | Implemented | Requires party ownership, CSRF, and non-completed party. |
| Join party | Implemented | Supports invited guests, pending approval for unknown emails, rate limiting, CSRF, and guest cookie. |
| Character assignment | Implemented | Supports assign, replace, and clear with uniqueness rules and audit logs. |
| Round controls | Implemented | Supports unlock/start/complete with audit logs and completed-party blocking. |
| Evidence controls | Implemented | Supports reveal/hide with audit logs and player-safe visibility. |
| Final reveal controls | Implemented | Supports victim reveal and solution reveal with round gates and audit logs. |
| Accusation form | Implemented | Player accusation create/update is guarded by guest cookie, round state, CSRF, and completed-party blocking. |
| Party completion/reopen | Implemented | Creates/removes `PartyResult` and blocks/re-enables runtime mutations. |
| Checkout start | Implemented foundation | Creates pending orders and redirects to Stripe when credentials exist; otherwise returns provider-not-configured. |
| Stripe webhook | Implemented foundation | Verifies signature, records event IDs idempotently, marks paid orders, and grants game access. |
| Support ticket | Implemented | Public/account support intake with rate limiting and CSRF. |
| Admin status/edit forms | Implemented | Admin-only game metadata, version status, support status, and outbound retry controls. |

## Remaining Link/Route Work

1. Add `/account/orders` for customer purchase history and game access.
2. Add deeper admin editors for characters, rounds, cards, evidence, media, and final reveal content.
3. Add upload routes after object storage is configured.
4. Add support reply routes after email provider delivery is selected.
5. Add creator routes later, after the first-party MVP is stable.
