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
| `app/join/` | Guest join page shell. Currently only collects or preserves a party code. |
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
| `app/join/page.tsx` | Guest join shell. Reads `?code=` from search params and displays a join form, but does not currently submit to a backend action. |

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
| `app/host/party/[partyId]/page.tsx` | Authenticated party control screen. Reads party and guests from Prisma, verifies current user owns party, shows invite code and guests, and allows adding another guest. |

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
- `app/lib/games.ts` maps database records into the public-safe shape used by pages and API routes.

### Party Creation

1. Host visits `/games/[slug]`.
2. Host clicks `Start party`, which links to `/host/create?game=slug`.
3. `/host/create` requires an authenticated user.
4. The page looks up the published game by slug from PostgreSQL.
5. Form posts to `createParty()`.
6. `createParty()` re-checks the current logged-in user, validates the published game, creates a `Party`, and creates optional initial `Guest` records in Prisma.
7. Host is redirected to `/host/party/[partyId]`.

### Party Management

1. `/host/party/[partyId]` requires login.
2. Page loads party by ID with guests.
3. Page verifies `party.hostId === user.id`.
4. Host can add one guest at a time through `addGuest()`.
5. Invite link is displayed as `/join?code=INVITECODE`.

### Guest Joining

`/join` is currently a form shell only. It reads a code from the URL, pre-fills the input, and submits as a normal GET back to the same route. It does not yet:

- Look up a party by invite code.
- Authenticate or identify a guest.
- Mark guests as joined.
- Assign characters.
- Show player cards or clues.

## Current Database Model

The current Prisma schema contains:

- `UserRole` enum: `HOST`, `PLAYER`, `ADMIN`
- `User`
- `UserSession`
- `Game`
- `GameVersion`
- `Product`
- `Party`
- `Guest`

Current model coverage is useful as a scaffold, but it is far short of the target game platform. It does not yet include:

- Orders
- Characters and assignments
- Required/optional character rules
- Rounds and round state
- Cards, clues, evidence, media, messages, accusations, or final reveals
- Spoiler rules
- Admin publishing workflow
- Marketplace entities
- Audit logging

## Current Architectural Assessment

The current app is a clean early scaffold rather than a full Base44 migration target. It already points toward the desired self-hosted stack, but it is not yet production-ready.

Strengths:

- Modern Next.js App Router structure.
- TypeScript strict mode enabled.
- Prisma/PostgreSQL foundation already present.
- Server Actions keep simple auth and party flows compact.
- Session cookie is HTTP-only and stores only opaque random tokens.
- Host ownership check exists on the party detail screen.

Gaps:

- No full game content data model.
- No payment/order ownership checks for activating games.
- No guest join backend flow.
- No character assignment.
- No round engine.
- No spoiler-safe content access layer.
- No media storage layer.
- No email/SMS invite integration.
- No admin game editor.
- Game catalog has basic database records, but not the full game-content model yet.
- Auth lacks password reset, email verification, rate limiting, CSRF hardening review, and account management.
- `.git` is not a usable repository in this workspace.
