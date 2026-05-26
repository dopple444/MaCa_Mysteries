# Current App Map

Last inspected: 2026-05-22

## Summary

This workspace is not the original Base44 generated app as described in the migration brief. It is already a small self-hosted Next.js scaffold for MaCa Mysteries with TypeScript, Tailwind CSS, Prisma, and a minimal PostgreSQL-oriented schema.

Important current-state notes:

- The app already contains `prisma/schema.prisma`.
- The app already contains Next.js API routes under `app/api`.
- The app already contains custom session/auth helpers under `app/lib`.
- No Base44 SDK usage was found in application source.
- The workspace is a Git working tree with a large uncommitted platform slice. Do not commit changes unless explicitly requested.

## Framework And Build Tooling

| Area | Current tool |
| --- | --- |
| Web framework | Next.js App Router |
| Language | TypeScript |
| UI library | React |
| Styling | Tailwind CSS plus `app/globals.css` |
| ORM | Prisma Client |
| Database target | PostgreSQL through `DATABASE_URL` |
| Package manager | npm |
| Lint script | `npm run lint`, mapped to `next lint` |
| Dev server | `npm run dev`, mapped to `next dev` |
| Build command | `npm run build`, mapped to `next build` |

Key dependency versions from `package.json`:

- `next`: `^15.0.3`
- `react`: `^19.0.0`
- `react-dom`: `^19.0.0`
- `typescript`: `^5.7.2`
- `tailwindcss`: `^3.4.16`
- `@prisma/client`: `^5.22.0`
- `prisma`: `^5.22.0`
- `lucide-react`: `^0.468.0`

## Major Folders

| Folder | Purpose |
| --- | --- |
| `app/` | Next.js App Router pages, layouts, API routes, styles, and server-side helper modules. |
| `app/api/` | Minimal API route handlers. Currently has health and database-backed game catalog endpoints. |
| `app/lib/` | Server-side helpers for auth, Prisma, database-backed games, and party actions. |
| `app/games/` | Public game catalog and game detail pages. |
| `app/host/` | Host-facing pages for learning about hosting, creating parties, and managing a created party. |
| `app/login/` | Host sign-in page with password reset link. |
| `app/signup/` | Host registration page that queues email verification. |
| `app/forgot-password/` | Password reset request page. |
| `app/reset-password/` | Signed-token password reset page. |
| `app/account/verify-email/` | Email verification status, resend, and confirmation route. |
| `app/dashboard/` | Authenticated host dashboard. |
| `app/join/` | Guest join page. Looks up parties by invite code and creates a guest session. |
| `app/play/` | Basic player lobby for joined guests waiting on character assignment. |
| `prisma/` | Prisma schema for current self-hosted data model. |
| `.next/` | Generated Next.js build/dev output. Should not be treated as source. |
| `node_modules/` | Installed npm dependencies. Should not be treated as source. |
| `.vscode/` | Local editor configuration. |
| `.agents/`, `.codex/` | Agent/tooling metadata directories. |

## Source Files

### App Shell

| File | Purpose |
| --- | --- |
| `app/layout.tsx` | Root HTML shell, metadata, global header, and navigation links for Home, Host, Join, and Games. |
| `app/globals.css` | Tailwind directives and global HTML/body styling. |
| `app/page.tsx` | Home landing screen with CTA links to host dashboard and join page. |

### Public And Customer Screens

| File | Purpose |
| --- | --- |
| `app/games/page.tsx` | Public catalog page. Reads published games from PostgreSQL through `app/lib/games.ts`. |
| `app/games/[slug]/page.tsx` | Public game detail page. Reads a published game by slug and uses `notFound()` when slug is unknown. |
| `app/join/page.tsx` | Mobile-friendly guest join form. Reads `?code=` from search params, submits to `joinParty()`, and shows validation errors. |
| `app/play/page.tsx` | Mobile-friendly guest-authenticated player view. Shows party, character, character tools, locked-content code-entry prompts, cards, evidence, media, digital artifacts, accusation form, reveal content, game, guest email, and guest status through player-safe filters. |

### Auth Screens

| File | Purpose |
| --- | --- |
| `app/login/page.tsx` | Host sign-in form. Submits to the `login` server action. Displays basic invalid-credential error state. |
| `app/signup/page.tsx` | Host account creation form. Submits to the `signup` server action. Displays basic missing-field and duplicate-email error states. |
| `app/dashboard/page.tsx` | Authenticated host dashboard. Calls `requireUser()`, displays host greeting, sign-out form, and links to host experience and game catalog. |

### Host Screens

| File | Purpose |
| --- | --- |
| `app/host/page.tsx` | Marketing/feature shell for host experience. Does not require auth and does not read backend data. |
| `app/host/create/page.tsx` | Authenticated party creation form. Reads selected game from `?game=slug` using `getGameBySlug()`. Submits to `createParty`. |
| `app/host/party/[partyId]/page.tsx` | Authenticated party control screen. Reads party, linked game/version, guests, invitation delivery state, gameplay state, and conditional unlock activity from Prisma, verifies current user owns party, shows invite code and guests, and allows adding another guest. |

### API Routes

| File | Purpose |
| --- | --- |
| `app/api/health/route.ts` | Returns `{ status: "ok", timestamp }`. Useful for uptime checks. |
| `app/api/games/route.ts` | Returns a public-safe JSON list of published games from PostgreSQL. |

### Server Helpers

| File | Purpose |
| --- | --- |
| `app/lib/prisma.ts` | Creates/reuses a Prisma Client instance and stores it on `globalThis` during development. |
| `app/lib/auth.ts` | Custom password hashing, password verification, session token creation, session clearing, current-user lookup, and auth guard. |
| `app/lib/auth-actions.ts` | Server actions for login, signup, and logout. Uses Prisma, rate limiting, CSRF, auth/account audit events, and redirects after completion. |
| `app/lib/auth-audit.ts` | Auth/account audit helper for sign-in success/failure/rate-limit events, logout, and account creation metadata. |
| `app/lib/admin-alerts.ts` | Shared admin alert recipient, admin URL, and dedupe-window helpers for operations email queues. |
| `app/lib/account-security.ts` | Signed account-action tokens, email verification queueing, password reset queueing, and password reset fulfillment. |
| `app/lib/account-security-actions.ts` | Server actions for verification resend, password reset request, and password reset confirmation. |
| `app/lib/account-recovery.ts` | Support-gated account recovery case service for ticket-linked case creation, identity review, safe reset/verification email queueing, recovery reports, repeated-request risk summaries, deduped risk alerts, and recovery audit events. |
| `app/lib/guest-auth.ts` | Guest cookie/session helpers for joined player access. |
| `app/lib/join-actions.ts` | Server action for joining a party by invite code, name, and email. |
| `app/lib/party-actions.ts` | Server actions for creating parties and adding guests. Generates invite codes and guest tokens. |
| `app/lib/notifications.ts` | Queues party invitation emails and updates guest invitation queue/resend state. |
| `app/lib/outbound-delivery.ts` | Outbound email/SMS helpers, provider selection, sent/failed/retry markers, Resend delivery, and invitation delivery-state synchronization. |
| `app/lib/games.ts` | Database-backed helpers for published game catalog reads and public game detail lookup. |
| `app/lib/admin-characters.ts` | Admin content-editing service for draft-version character create/update validation, duplicate key checks, and required-character coverage. |
| `app/lib/admin-rounds.ts` | Admin content-editing service for draft-version round/card create/update validation, visibility checks, duplicate keys, and published-version locks. |
| `app/lib/admin-evidence.ts` | Admin content-editing service for draft-version evidence/media metadata validation, linkage checks, duplicate keys, and published-version locks. |
| `app/lib/admin-builder.ts` | Admin content-editing service for draft-version digital artifacts, character tools, unlock rules, JSON payload validation, target linkage checks, access-code tool checks, duplicate keys, and published-version locks. |
| `app/lib/builder-preview.ts` | Admin preview projection service for host-safe, spoiler-host, and character-specific views using round progress and simulated unlock rules. |
| `app/lib/publish-readiness.ts` | Game-version validation service used before publishing; checks required content, final reveal presence, version-owned links, required unlock rules, and access-code generator wiring. |
| `app/lib/admin-version-status.ts` | Admin game-version status service that blocks unsafe publish attempts, updates publish timestamps, and audits status changes. |
| `app/lib/admin-users.ts` | Super-admin account operations service for bootstrap-safe role assignment, sensitive role-change approval requests, last-super-admin protection, session revocation, account search/filtering, recent account-security event lookup, and audit logging. |
| `app/lib/conditional-unlocks.ts` | Conditional reveal service for actor visibility checks, guest/host unlock projections, party tool code creation, access-code attempts, and unlock events. |
| `app/lib/conditional-activity.ts` | Host-safe and admin conditional activity projection for code attempts and unlock events. Host views redact rule/tool labels unless spoiler mode is explicitly unlocked; admin/global monitoring and alert queueing never return stored code hashes. |
| `app/lib/player-artifacts.ts` | Player-safe digital artifact projection helper that filters artifacts by character, round state, evidence/media dependencies, and unlock events. |
| `app/lib/player-tools.ts` | Player-facing character tool service that creates party-specific access-code tool instances, projects visible tool codes, lists locked evidence/card/media/artifact prompts, and submits code unlock attempts without storing raw codes. |
| `app/lib/storage.ts` | Storage provider detection, media upload validation, and local public/private upload writes. |

### Configuration

| File | Purpose |
| --- | --- |
| `package.json` | npm scripts and dependency declarations. |
| `package-lock.json` | Locked dependency tree. |
| `next.config.ts` | Next config. Currently enables Server Actions body size limit of `2mb`. |
| `tsconfig.json` | Strict TypeScript config using Next.js plugin and bundler module resolution. |
| `tailwind.config.ts` | Tailwind content paths for `app/` and optional `components/`. |
| `postcss.config.js` | Tailwind and Autoprefixer PostCSS setup. |
| `.env.example` | Example `DATABASE_URL` for PostgreSQL. |
| `.gitignore` | Ignore rules. |
| `next-env.d.ts` | Generated Next TypeScript declarations. |
| `tsconfig.tsbuildinfo` | Generated TypeScript incremental build cache. |

## Current Data Flow

### Auth

1. `/signup` posts a server action to `signup()`.
2. `signup()` validates fields, creates a `User` with `role: HOST`, stores `passwordHash`, creates a session, and redirects to `/dashboard`.
3. `/login` posts to `login()`.
4. `login()` verifies email/password, enforces rate limits and the consecutive-failure account lockout policy, audits success/failure/rate-limit/lockout events, creates a session, and redirects to `/dashboard` or email verification.
5. Sessions are stored in the `UserSession` table as SHA-256 token hashes with IP address, user-agent, created-by, last-seen, expiration, and revocation metadata.
6. The browser receives an HTTP-only cookie named `maca_session`.
7. `requireUser()` redirects unauthenticated users to `/login`.

### Games

Game catalog data is now database-backed:

- `Game` stores public catalog identity, player counts, duration, and publish status.
- `GameVersion` stores versioned metadata such as themes and publish status.
- `Product` stores the first basic sales/product record for each game.
- `Party` keeps `gameSlug` for compatibility and now also stores nullable `gameId` and `gameVersionId` links.
- `app/lib/games.ts` maps database records into the public-safe shape used by pages and API routes.

### Party Creation

1. Host visits `/games/[slug]`.
2. Host clicks `Start party`, which links to `/host/create?game=slug`.
3. `/host/create` requires an authenticated user.
4. The page looks up the published game by slug from PostgreSQL.
5. Form posts to `createParty()`.
6. `createParty()` re-checks the current logged-in user, validates the published game, creates a `Party` linked to the published game/version, creates optional initial `Guest` records in Prisma, and queues invitation emails.
7. Host is redirected to `/host/party/[partyId]`.

### Party Management

1. `/host/party/[partyId]` requires login.
2. Page loads party by ID with guests, invitation delivery state, assignments, rounds, evidence, media, accusations, final reveal state, party result, and recent audit activity.
3. Page verifies `party.hostId === user.id`.
4. Host can add one guest at a time through `addGuest()`.
5. Invite link is displayed as `/join?code=INVITECODE`.
6. Host can approve pending guests, assign/clear characters, review invitation status/failures, resend invites, unlock spoiler mode, unlock/start/complete rounds, reveal/hide evidence, reveal/hide victim/final solution content, and complete/reopen a party.
7. Completed parties block gameplay mutations until reopened.

### Guest Joining

`/join` supports the guest join flow:

1. Guest opens `/join?code=INVITECODE` or enters a party code manually.
2. Guest enters name and email.
3. `joinParty()` looks up the party by invite code.
4. If the email matches an invited guest for that party, that guest is updated.
5. If no invited guest matches, a pending guest request is created for host approval.
6. Joined guests receive an HTTP-only `maca_guest` cookie and are redirected to `/play`.
7. Player-visible cards, evidence, media, digital artifacts, character tools, locked-content prompts, accusations, victim reveal, and final reveal content are filtered by assignment, round state, reveal state, and conditional unlock events.

### Conditional Reveals

The app now has a foundation for advanced builder-authored unlock mechanics:

1. Authored cards, evidence, and media can store `requiredUnlockRuleId`.
2. `GameDigitalArtifact`, `GameCharacterTool`, and `GameUnlockRule` describe future builder content and conditional mechanics.
3. `PartyToolInstance`, `PartyCodeAttempt`, and `PartyUnlockEvent` record party-specific code tools, attempted unlocks, and successful unlocks.
4. `/play` loads party unlock events and passes the current guest's unlocked rule IDs into player-safe card/evidence/media helpers.
5. `/play` also shows character-specific access-code generator tools and locked evidence/card/media/artifact code-entry prompts through `app/lib/player-tools.ts`.
6. `POST /play/unlock` validates player access, CSRF, rate limits, target availability, and access-code hashes before recording successful unlock events for cards, evidence, media, or digital artifacts.
7. Host party control shows sanitized conditional unlock activity through `app/lib/conditional-activity.ts`.
8. Player-safe helpers hide conditionally locked content until the actor, assignment, round/reveal state, and unlock state all allow it.
9. Admin game detail pages include draft-only editors for digital artifacts, character tools, and unlock rules.
10. Builder editor routes validate CSRF/admin access, save through `app/lib/admin-builder.ts`, and audit create/update events.
11. Admin builder preview pages use `app/lib/builder-preview.ts` to project visible cards, evidence, media, digital artifacts, and tools as host-safe host, spoiler host, or a selected character.

## Current Database Model

The current Prisma schema contains:

- `UserRole` enum: `HOST`, `PLAYER`, `ADMIN`, `SUPER_ADMIN`, `CONTENT_EDITOR`, `SUPPORT`, `FINANCE`
- `User`
- `UserSession`
- `Game`
- `GameVersion`
- `GameCharacter`
- `GameRound`
- `GameCard`
- `GameEvidence`
- `GameMediaAsset`
- `GameFinalReveal`
- `GameDigitalArtifact`
- `GameCharacterTool`
- `GameUnlockRule`
- `Product`
- `Order`
- `OrderItem`
- `UserGameAccess`
- `PaymentWebhookEvent`
- `Party`
- `Guest`
- `PartyCharacterAssignment`
- `PartyRoundState`
- `PartyEvidenceReveal`
- `PartyFinalRevealState`
- `PartyAccusation`
- `PartyResult`
- `PartyToolInstance`
- `PartyUnlockEvent`
- `PartyCodeAttempt`
- `PartyAssetView`
- `PartyPlayerInteraction`
- `PartyPlayerInventory`
- `OutboundMessage`
- `SupportTicket`
- `SupportTicketMessage`
- `AuditLog`
- `AdminActionRequest`
- `AccountRecoveryCase`
- `RateLimitBucket`

`Guest` now carries both party participation status and invitation delivery state: queued/sent/failed status, last queued/sent timestamps, resend count, and last failure detail.

Current model coverage is strong enough for the first-party MVP foundation plus the first Game Builder / Conditional Reveal foundation. Still missing or shallow areas include final reveal editing, deeper readiness checks for circular/spoiler-wording rule risks, provider delivery webhooks, production object storage/signed URLs, account recovery drill evidence, and future marketplace entities.

## Current Architectural Assessment

The current app is now a working self-hosted MVP foundation rather than only a scaffold. It still needs production hardening and content editing depth, but the main first-party purchase, hosting, guest, round, evidence, accusation, reveal, support, and admin foundations are in place.

Strengths:

- Modern Next.js App Router structure.
- TypeScript strict mode enabled.
- Prisma/PostgreSQL foundation already present.
- Server Actions keep simple auth and party flows compact.
- Session cookie is HTTP-only and stores only opaque random tokens.
- Host ownership checks exist on party pages and mutation routes.
- Game, version, character, round, card, evidence, media, final reveal, builder/conditional, party, guest, assignment, accusation, result, order, support, audit, admin action request, account recovery case, outbound message, webhook, and rate-limit models exist.
- CSRF tokens are wired into mutation forms and route handlers, with strict production rejection.
- Rate limiting protects auth, join, support, and checkout-start flows.
- Stripe-ready checkout and signed webhook handling exist, but provider credentials are not configured.
- Docker production scaffolding and deployment notes exist, while the current live server still runs directly on Ubuntu.

Gaps:

- Admin content editing now covers metadata, draft game creation, characters, rounds, cards, evidence, media metadata, digital artifacts, character tools, unlock rules, preview-as-host/character projections, and publish-readiness checks; final reveal editing still needs a dedicated editor.
- Real payment processing needs Stripe test credentials and dashboard/webhook verification before selling games.
- Email records can be queued, delivered through console dry-run or Resend, failed, and retried. Support replies queue customer emails and internal notes stay local. SMS records can be queued, failed, and retried, but no real SMS provider adapter is enabled yet.
- Local admin media upload endpoints are enabled; S3-compatible writes, private signed URLs, malware scanning, and admin review are still needed.
- Auth now has email verification, password reset, consecutive-failure account lockout, deduped account lockout alert emails, session metadata/revocation records, session invalidation after role changes/password reset/logout, super-admin role assignment, sensitive role-change approval requests, super-admin session revocation, support/admin recovery case tooling, recovery risk reporting/alerts, login/logout/account audit events, and visible account-security audit history foundations. It still lacks OAuth and more advanced behavioral risk scoring.
- Admin role values and route gates now support full admin, content editor, finance, and support scopes.
- A dedicated test database now exists for standard automated tests; backup automation is still needed before production launch.
