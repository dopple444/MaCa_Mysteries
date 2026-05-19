# Current App Map

Last inspected: 2026-05-17

## Summary

This workspace is not the original Base44 generated app as described in the migration brief. It is already a small self-hosted Next.js scaffold for MaCa Mysteries with TypeScript, Tailwind CSS, Prisma, and a minimal PostgreSQL-oriented schema.

Important current-state notes:

- The app already contains `prisma/schema.prisma`.
- The app already contains Next.js API routes under `app/api`.
- The app already contains custom session/auth helpers under `app/lib`.
- No Base44 SDK usage was found in application source.
- The local `.git` directory appears to be an empty directory, so this workspace is not currently functioning as a Git repository.

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
| `app/login/` | Host sign-in page. |
| `app/signup/` | Host registration page. |
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
| `app/join/page.tsx` | Guest join form. Reads `?code=` from search params, submits to `joinParty()`, and shows validation errors. |
| `app/play/page.tsx` | Basic guest-authenticated player lobby. Shows party, game, guest email, guest status, and a waiting message. |

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
| `app/host/party/[partyId]/page.tsx` | Authenticated party control screen. Reads party, linked game/version, and guests from Prisma, verifies current user owns party, shows invite code and guests, and allows adding another guest. |

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
| `app/lib/auth-actions.ts` | Server actions for login, signup, and logout. Uses Prisma and redirects after completion. |
| `app/lib/guest-auth.ts` | Guest cookie/session helpers for joined player access. |
| `app/lib/join-actions.ts` | Server action for joining a party by invite code, name, and email. |
| `app/lib/party-actions.ts` | Server actions for creating parties and adding guests. Generates invite codes and guest tokens. |
| `app/lib/games.ts` | Database-backed helpers for published game catalog reads and public game detail lookup. |

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
4. `login()` verifies email/password, creates a session, and redirects to `/dashboard`.
5. Sessions are stored in the `UserSession` table as SHA-256 token hashes.
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
6. `createParty()` re-checks the current logged-in user, validates the published game, creates a `Party` linked to the published game/version, and creates optional initial `Guest` records in Prisma.
7. Host is redirected to `/host/party/[partyId]`.

### Party Management

1. `/host/party/[partyId]` requires login.
2. Page loads party by ID with guests, assignments, rounds, evidence, media, accusations, final reveal state, party result, and recent audit activity.
3. Page verifies `party.hostId === user.id`.
4. Host can add one guest at a time through `addGuest()`.
5. Invite link is displayed as `/join?code=INVITECODE`.
6. Host can approve pending guests, assign/clear characters, resend invites, unlock/start/complete rounds, reveal/hide evidence, reveal/hide victim/final solution content, and complete/reopen a party.
7. Completed parties block gameplay mutations until reopened.

### Guest Joining

`/join` supports the guest join flow:

1. Guest opens `/join?code=INVITECODE` or enters a party code manually.
2. Guest enters name and email.
3. `joinParty()` looks up the party by invite code.
4. If the email matches an invited guest for that party, that guest is updated.
5. If no invited guest matches, a pending guest request is created for host approval.
6. Joined guests receive an HTTP-only `maca_guest` cookie and are redirected to `/play`.
7. Player-visible cards, evidence, media, accusations, victim reveal, and final reveal content are filtered by assignment, round state, and reveal state.

## Current Database Model

The current Prisma schema contains:

- `UserRole` enum: `HOST`, `PLAYER`, `ADMIN`
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
- `OutboundMessage`
- `SupportTicket`
- `AuditLog`
- `RateLimitBucket`

Current model coverage is strong enough for the first-party MVP foundation. Still missing or shallow areas include full admin content editors, support reply history, real provider delivery records, upload object metadata beyond seeded assets, fine-grained admin roles, and future marketplace entities.

## Current Architectural Assessment

The current app is now a working self-hosted MVP foundation rather than only a scaffold. It still needs production hardening and content editing depth, but the main first-party purchase, hosting, guest, round, evidence, accusation, reveal, support, and admin foundations are in place.

Strengths:

- Modern Next.js App Router structure.
- TypeScript strict mode enabled.
- Prisma/PostgreSQL foundation already present.
- Server Actions keep simple auth and party flows compact.
- Session cookie is HTTP-only and stores only opaque random tokens.
- Host ownership checks exist on party pages and mutation routes.
- Game, version, character, round, card, evidence, media, final reveal, party, guest, assignment, accusation, result, order, support, audit, outbound message, webhook, and rate-limit models exist.
- CSRF tokens are wired into mutation forms and route handlers, with strict production rejection.
- Rate limiting protects auth, join, support, and checkout-start flows.
- Stripe-ready checkout and signed webhook handling exist, but provider credentials are not configured.
- Docker production scaffolding and deployment notes exist, while the current live server still runs directly on Ubuntu.

Gaps:

- Admin content editing is still shallow; metadata and draft game creation exist, but full character, round, card, evidence, media, and final reveal editors are still needed.
- Real payment processing needs Stripe test credentials and dashboard/webhook verification before selling games.
- Email and SMS records can be queued, failed, and retried, but no real provider adapter is enabled yet.
- Media upload endpoints are not enabled yet; storage policy helpers exist.
- Auth still lacks password reset, email verification, account recovery, and session revocation.
- Admin roles are still coarse: `ADMIN` is all-powerful.
- A dedicated test database and backup automation are still needed before production launch.
