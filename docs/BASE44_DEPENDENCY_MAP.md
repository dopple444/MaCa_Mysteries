# Base44 Dependency Map

Last inspected: 2026-05-17

## Summary

No Base44 application dependencies were found in this workspace's source code.

Search terms checked across the codebase:

- `@base44/sdk`
- `base44`
- `base44.entities`
- `base44.auth`
- `base44.functions`
- `base44.integrations`
- `InvokeLLM`
- `SendEmail`
- `UploadFile`
- `functions`
- `integrations`

The only matches were unrelated npm package-lock entries for a dependency named `functions-have-names`.

This means the current `/home/dopple444/projects/MaCa_Mysteries` workspace appears to be a self-hosted Next.js/Prisma scaffold or partial migration rather than the original Base44-generated codebase.

## Findings Table

| File path | Import or function/entity used | Operation being performed | Data read/written | Affects | Proposed self-hosted replacement | Proposed API route | Proposed PostgreSQL/Prisma table or service |
| --- | --- | --- | --- | --- | --- | --- | --- |
| None found in app source | None | None | None | None | No direct Base44 replacement required in this workspace | None for Base44 parity | None for Base44 parity |

## Existing Self-Hosted Replacements Already Present

The following areas already use local/self-hosted code instead of Base44.

| Current file | Existing local behavior | Current data involved | Migration note |
| --- | --- | --- | --- |
| `app/lib/prisma.ts` | Creates Prisma Client | PostgreSQL through `DATABASE_URL` | Keep as data access foundation, but add service boundaries as domain grows. |
| `prisma/schema.prisma` | Defines users, sessions, parties, guests, games, game versions, and basic products | `User`, `UserSession`, `Party`, `Guest`, `Game`, `GameVersion`, `Product` | Expand substantially for gameplay, media, commerce, and admin workflows. |
| `app/lib/auth.ts` | Custom session auth with HTTP-only cookie | Users and sessions | Replace or harden later with production auth patterns, password reset, verification, rate limiting, and audit logging. |
| `app/lib/auth-actions.ts` | Login, signup, logout Server Actions | Users and sessions | Can remain short-term. Consider moving to explicit route handlers/services if API clients/mobile clients are added. |
| `app/lib/party-actions.ts` | Party creation and guest add actions | Parties and guests | Host authorization is now server-side; still needs integration with purchased/activated game ownership. |
| `app/api/games/route.ts` | Returns published public game list | PostgreSQL game catalog data | Keep public-safe; do not expose spoiler content. |

## Base44 Capability Replacement Plan

Even though no Base44 calls remain in this workspace, the original platform concept likely relied on Base44-style hosted capabilities. These are the proposed replacement areas for the target architecture.

### Authentication

Likely Base44 equivalent:

- `base44.auth`
- hosted user accounts
- current user lookup
- login/logout/session state

Current local equivalent:

- `app/lib/auth.ts`
- `app/lib/auth-actions.ts`
- `User`
- `UserSession`
- `maca_session` cookie

Proposed self-hosted replacement:

- Keep PostgreSQL-backed users and sessions for now.
- Add email verification, password reset, role management, session revocation, rate limiting, and audit logging.
- Consider Auth.js only if OAuth/social login becomes important.

Proposed routes/services:

- `POST /api/auth/signup`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `POST /api/auth/password-reset/request`
- `POST /api/auth/password-reset/confirm`
- `GET /api/auth/me`

Proposed tables/services:

- `users`
- `user_sessions`
- `accounts` if OAuth is added
- `password_reset_tokens`
- `email_verification_tokens`
- `audit_log`

### Database Entities

Likely Base44 equivalent:

- `base44.entities.*`

Current local equivalent:

- Prisma models for `User`, `UserSession`, `Party`, and `Guest`
- Hard-coded game arrays for game catalog content

Proposed self-hosted replacement:

- PostgreSQL with Prisma.
- Domain services for catalog, purchases, parties, game content, gameplay state, and admin publishing.

Proposed routes/services:

- `GET /api/games`
- `GET /api/games/[slug]`
- `POST /api/parties`
- `GET /api/parties/[partyId]`
- `POST /api/parties/[partyId]/guests`
- `POST /api/parties/[partyId]/assignments`
- `POST /api/parties/[partyId]/rounds/[roundId]/unlock`
- `GET /api/player/party/[partyId]`

Proposed tables:

- `games`
- `game_versions`
- `game_characters`
- `game_rounds`
- `game_cards`
- `game_evidence`
- `game_media_assets`
- `game_messages`
- `party_instances`
- `party_guests`
- `party_character_assignments`
- `party_round_state`
- `party_evidence_reveals`
- `party_messages`
- `party_accusations`
- `party_results`

### Functions

Likely Base44 equivalent:

- `base44.functions`
- generated backend functions

Current local equivalent:

- Server Actions:
  - `login`
  - `signup`
  - `logout`
  - `createParty`
  - `addGuest`
- Route handlers:
  - `GET /api/health`
  - `GET /api/games`

Proposed self-hosted replacement:

- Keep Server Actions for form-native app flows.
- Introduce domain services and route handlers for workflows that need API access, webhooks, mobile-friendly clients, background jobs, or external integrations.

Proposed routes/services:

- `app/api/*/route.ts` for HTTP APIs.
- `app/lib/services/*` for business logic.
- Background job worker later for scheduled emails/SMS, media processing, payment webhooks, and reminders.

### Email

Likely Base44 equivalent:

- `SendEmail`
- `base44.integrations.email`

Current local equivalent:

- None.
- Guest records are created, but no invitation emails are sent.

Proposed self-hosted replacement:

- Transactional email provider such as Resend, Postmark, SendGrid, or Amazon SES.
- Email templates for account verification, password reset, purchase receipt, host invite, guest invite, reminder, support ticket, and creator notices.

Proposed routes/services:

- `POST /api/parties/[partyId]/invites/send`
- `POST /api/support/tickets`
- `POST /api/webhooks/email`
- `app/lib/services/email.ts`

Proposed tables/services:

- `party_guests`
- `party_messages`
- `support_tickets`
- `email_delivery_log` later

### Files And Media

Likely Base44 equivalent:

- `UploadFile`
- hosted file storage

Current local equivalent:

- None.

Proposed self-hosted replacement:

- Object storage layer compatible with S3 APIs.
- Local MinIO in development if needed later.
- Production options: S3, Backblaze B2, Cloudflare R2, or self-hosted object storage.
- Store metadata in PostgreSQL and binary files outside the database.

Proposed routes/services:

- `POST /api/media/upload-url`
- `POST /api/media/complete`
- `GET /api/media/[assetId]`
- `app/lib/services/media.ts`

Proposed tables:

- `game_media_assets`
- `party_media_assets` later if hosts upload custom assets
- `audit_log`

### AI

Likely Base44 equivalent:

- `InvokeLLM`
- AI-generated content/functions

Current local equivalent:

- None.

Proposed self-hosted replacement:

- No AI dependency is required for the MVP gameplay engine.
- Later admin/creator tools may use OpenAI APIs for drafting clue variants, character copy, summaries, safety checks, or content QA.
- AI-generated content should be review-gated and stored as drafts, not published directly to players.

Proposed routes/services:

- Later: `POST /api/admin/ai/draft-clue`
- Later: `POST /api/admin/ai/content-check`
- Later: `app/lib/services/ai.ts`

Proposed tables:

- `admin_ai_generations` later
- `audit_log`

### Business Logic

Likely Base44 equivalent:

- generated entity queries
- hosted functions
- integration glue

Current local equivalent:

- `createParty()` and `addGuest()` in `app/lib/party-actions.ts`
- Basic authorization in `app/host/party/[partyId]/page.tsx`

Proposed self-hosted replacement:

- Dedicated domain services with explicit spoiler-safe access checks.
- Game engine service that calculates which cards, clues, evidence, messages, and reveals are visible to each role at each party state.

Proposed services:

- `gameCatalogService`
- `partyService`
- `guestService`
- `characterAssignmentService`
- `roundEngineService`
- `spoilerPolicyService`
- `mediaService`
- `commerceService`
- `notificationService`

Proposed API routes:

- `POST /api/parties`
- `GET /api/parties/[partyId]`
- `POST /api/parties/[partyId]/guests`
- `POST /api/parties/[partyId]/assignments`
- `GET /api/parties/[partyId]/host-state`
- `GET /api/parties/[partyId]/player-state`
- `POST /api/parties/[partyId]/rounds/[roundNumber]/unlock`
- `POST /api/parties/[partyId]/accusations`
- `POST /api/parties/[partyId]/final-reveal`

## Follow-Up Needed

If the original Base44 code still exists elsewhere, inspect that repository or export directly. The current workspace cannot map real Base44 entity names, function names, or generated code that is not present here.

Recommended follow-up searches when the original export is available:

```bash
rg -n "@base44/sdk|base44|base44\\.entities|base44\\.auth|base44\\.functions|base44\\.integrations|InvokeLLM|SendEmail|UploadFile" .
rg -n "entities\\.|auth\\.|functions\\.|integrations\\." .
rg -n "Party|Game|Guest|Character|Clue|Evidence|Round|Invite|Email|Upload|LLM" .
```
