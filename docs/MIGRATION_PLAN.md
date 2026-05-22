# Migration Plan

Last inspected: 2026-05-21

## Current Reality Check

The app in this workspace is already a small Next.js/TypeScript/Prisma scaffold. It is not currently showing Base44 SDK usage. The migration plan should therefore preserve the scaffold, document what exists, and grow it deliberately into the target self-hosted platform.

Do not delete the old Base44 code if it exists elsewhere. Do not rewrite the UI before the backend and domain model are understood.

## Phase 1: Run And Document The Existing App

Goal:

- Establish a known baseline of what exists, what routes work, and what code depends on which systems.

Deliverables:

- Documentation in `/docs`.
- Route inventory.
- Base44 dependency map.
- Current Prisma schema summary.
- Known gaps and risks.
- Basic run/build notes.

Files likely affected:

- `docs/*`
- No application code required.

Risks:

- Current workspace may not match the original Base44 repo.
- `.git` is not usable in this workspace.
- Existing Prisma/PostgreSQL setup may not be fully migrated or seeded.

Completion criteria:

- All requested docs exist.
- The current architecture is mapped.
- Base44 usage search has been recorded.
- Next development steps are clear.

## Phase 2: Create Docker/PostgreSQL/Prisma Foundation

Goal:

- Make local development reproducible and prepare the app for self-hosted deployment.

Deliverables:

- Docker Compose for app and PostgreSQL.
- `.env` conventions.
- Prisma migration workflow.
- Seed data for first-party games.
- Database backup/restore notes.

Files likely affected:

- `docker-compose.yml`
- `Dockerfile`
- `.env.example`
- `prisma/schema.prisma`
- `prisma/migrations/*`
- `prisma/seed.ts`
- `package.json`
- `README.md`

Risks:

- Existing database may contain data not represented by migrations.
- Docker networking and server deployment details may differ from local VS Code Remote SSH setup.
- Prisma migration history must be managed carefully.

Completion criteria:

- New developer can run app and database locally with documented commands.
- Prisma client generates cleanly.
- Migrations apply to an empty database.
- Seed data loads sample first-party games.

## Phase 3: Replace Base44 Data Calls With Self-Hosted API Routes

Goal:

- Ensure all data access goes through owned code and PostgreSQL-backed services.

Deliverables:

- Domain services for games, parties, guests, auth, and catalog reads.
- API routes or Server Actions replacing any remaining hosted/generated calls.
- Error handling and authorization patterns.
- Tests for critical service functions.

Files likely affected:

- `app/api/**/route.ts`
- `app/lib/**`
- `prisma/schema.prisma`
- `app/games/**`
- `app/host/**`
- `app/join/**`

Risks:

- Original Base44 code may have hidden behavior that is not present in the current scaffold.
- Authorization bugs can expose private or spoiler content.
- Server Actions can become hard to reuse for external clients if not separated from domain services.

Completion criteria:

- No Base44 imports or hosted entity calls remain in the active app.
- All reads/writes are through Prisma-backed services.
- Access checks are server-side.

## Phase 4: Build Game Catalog And Game Detail Pages From The Database

Goal:

- Maintain and extend the database-backed first-party catalog foundation.

Deliverables:

- `games`, `game_versions`, and `products` basics are present.
- `game_media_assets` remains a follow-up.
- Published game listing.
- Game detail page from database.
- Seeded first-party games.
- Public-safe data projection.

Files likely affected:

- `prisma/schema.prisma`
- `prisma/seed.ts`
- `app/lib/games.ts`
- `app/api/games/route.ts`
- `app/games/page.tsx`
- `app/games/[slug]/page.tsx`

Risks:

- Spoiler content accidentally included in public queries.
- Catalog/product mismatch if commerce model is rushed.
- Public catalog records are basic and do not yet cover media, merchandising, or full game content.

Completion criteria:

- `/games` loads from PostgreSQL.
- `/games/[slug]` loads from PostgreSQL.
- Public API returns only public-safe fields.
- Hard-coded game arrays are no longer the source of truth.

## Phase 5: Build Host Party Creation And Guest Invitations

Goal:

- Let a host create a party from an entitled game and invite guests reliably.

Deliverables:

- Party instance model tied to game version.
- Entitlement/purchase check placeholder or real check.
- Guest invite records.
- Invite links/tokens.
- Email sending interface, even if initially stubbed.

Files likely affected:

- `prisma/schema.prisma`
- `app/host/create/page.tsx`
- `app/host/party/[partyId]/page.tsx`
- `app/lib/party-actions.ts`
- `app/lib/services/party.ts`
- `app/lib/services/email.ts`

Risks:

- Hosts may create parties for games they do not own.
- Invite tokens may be too exposed or not revocable.
- Email provider integration can delay gameplay work.

Completion criteria:

- Authenticated host can create a party for an allowed game.
- Guests can be invited and receive or copy a secure join link.
- Host can see invite delivery/join status.

## Phase 6: Build Character Assignment

Goal:

- Assign guests to required and optional characters with validation.

Deliverables:

- Character tables and assignment table.
- Required/optional character metadata.
- Host assignment UI.
- Auto-assignment option later if useful.
- Validation that required characters are filled before starting.

Files likely affected:

- `prisma/schema.prisma`
- `app/host/party/[partyId]/page.tsx`
- `app/host/party/[partyId]/assignments/page.tsx`
- `app/lib/services/characters.ts`
- `app/lib/services/party.ts`

Risks:

- Character labels may reveal victim/killer too early.
- Optional characters may accidentally hold critical clues.
- Reassignment after guests have seen content can cause state conflicts.

Completion criteria:

- Host can assign/reassign characters.
- Required missing characters block start.
- Optional characters can remain unassigned.
- Player-private access follows assignment.

## Phase 7: Build Round Engine And Spoiler Controls

Goal:

- Control what each user can see based on party, round, assignment, spoiler mode, and conditional unlock state.

Deliverables:

- Round state model.
- Round unlock controls.
- Spoiler-safe host view.
- Explicit host spoiler unlock with audit log.
- Player content projection service.
- Final reveal gating.
- Conditional visibility service for cards, evidence, media, and future digital artifacts.
- Unlock-event projection for player-safe reads.

Files likely affected:

- `prisma/schema.prisma`
- `app/host/party/[partyId]/**`
- `app/play/**`
- `app/lib/player-cards.ts`
- `app/lib/player-evidence.ts`
- `app/lib/player-media.ts`
- `app/lib/conditional-unlocks.ts`
- `app/lib/audit-log.ts`

Risks:

- Spoiler leakage through API payloads.
- Host UI may accidentally show solution details by default.
- Round state transitions may be inconsistent if implemented only in UI.

Completion criteria:

- Players see only content for their character and unlocked round.
- Host safe mode hides solution/victim/killer content by default.
- Spoiler unlock is explicit and logged.
- Round state controls are persisted.
- Conditional locked content stays hidden until an authorized unlock event exists.

## Phase 8: Build Media-Rich Gameplay Experience

Goal:

- Support immersive clues and evidence using images, video, audio, documents, fake messages, fake emails, digital artifacts, and locked evidence.

Deliverables:

- Media asset metadata.
- Object storage integration.
- Media rendering components.
- Evidence reveal workflow.
- Message-style clue components.
- Accessibility metadata for assets.
- Digital artifact model for documents, fake emails, fake text messages, investigation sheets, restricted folders, and inventory-style clues.
- Character tool model for keys, decoders, scanners, access-code generators, and other player-specific mechanics.

Files likely affected:

- `prisma/schema.prisma`
- `app/lib/services/media.ts`
- `app/lib/conditional-unlocks.ts`
- `app/api/media/**`
- `app/play/**`
- `app/host/party/[partyId]/**`
- shared components if a `components/` folder is introduced

Risks:

- Large file storage on the app server can become expensive or fragile.
- Media permissions can leak spoiler content.
- Audio/video format compatibility varies by browser.

Completion criteria:

- Admin/content seed can attach media assets to game content.
- Players can view/hear only unlocked media.
- Hosts can reveal evidence intentionally.
- Media is stored outside the database.
- Locked evidence and media can depend on explicit unlock rules without leaking through player-safe views.

## Phase 9: Build Internal Game Builder And Admin Game Editor

Goal:

- Let internal admins create, edit, version, preview, validate, and publish first-party games through a path that can later become the Game Builder Wizard.

Deliverables:

- Admin role guard.
- Game editor screens.
- Versioning workflow.
- Spoiler preview tools.
- Validation for missing required content.
- Publish/retire controls.
- Editors for digital artifacts, character tools, and unlock rules.
- Preview as host-safe host, spoiler host, and specific assigned character.
- Conditional reveal validation for unresolved targets, orphan rules, required unlock linkage, missing access-code generators, impossible unlocks, and unsafe spoiler labels.

Files likely affected:

- `app/admin/**`
- `app/lib/admin-characters.ts`
- `app/lib/admin-rounds.ts`
- `app/lib/admin-evidence.ts`
- `app/lib/conditional-unlocks.ts`
- `app/lib/publishing.ts`
- `prisma/schema.prisma`

Risks:

- Editor complexity can slow MVP if built too early.
- Invalid content can break live parties.
- Admin preview must distinguish player, host-safe, and spoiler views.
- Conditional rules can create impossible content paths if validation is weak.
- Creator-ready abstractions can add complexity before first-party editing is stable.

Completion criteria:

- Admin can create a draft game version.
- Admin can validate and publish a version.
- Published versions are immutable for existing parties.
- Admin can author and inspect conditional reveal mechanics in draft versions.
- Preview helpers prove that locked content is visible only to the intended actor/state.

Current foundation implemented:

- `GameDigitalArtifact`, `GameCharacterTool`, `GameUnlockRule`, `PartyToolInstance`, `PartyUnlockEvent`, `PartyCodeAttempt`, `PartyAssetView`, `PartyPlayerInteraction`, and `PartyPlayerInventory` exist.
- `GameCard`, `GameEvidence`, and `GameMediaAsset` can reference `requiredUnlockRuleId`.
- Player-safe card/evidence/media services honor conditional unlock state.
- Admin game detail pages inspect builder-foundation counts and unlock-rule summaries.
- Admin game detail pages show publish-readiness errors/warnings, and the publish route blocks versions with readiness errors.
- Tests cover role visibility separation, cross-player access-code unlock behavior, builder preview behavior, and publish-readiness blocking.

## Phase 10: Prepare Payment/Email/SMS Integrations

Goal:

- Support paid purchases and reliable communication.

Deliverables:

- Payment provider integration.
- Products, orders, order items, entitlements.
- Payment webhook verification.
- Transactional email provider.
- SMS provider abstraction if needed.
- Receipt, invite, reminder, and support templates.

Files likely affected:

- `prisma/schema.prisma`
- `app/api/webhooks/**`
- `app/lib/services/commerce.ts`
- `app/lib/services/email.ts`
- `app/lib/services/sms.ts`
- `app/account/**`
- `app/checkout/**`

Risks:

- Payment webhooks must be idempotent.
- Tax/refund handling may add complexity.
- SMS compliance and costs can be non-trivial.
- Emails can expose party links if tokens are weak.

Completion criteria:

- Customer can purchase or activate a first-party game.
- Paid order grants entitlement.
- Invite and receipt emails send through provider.
- Webhooks are verified and idempotent.

## Phase 11: Prepare Production/Data-Center Deployment

Goal:

- Deploy securely on a server you control now, with a path to data-center deployment later.

Deliverables:

- Production Docker image.
- Reverse proxy/TLS plan.
- Database backup strategy.
- Environment variable/secrets management.
- Logging and monitoring.
- Health checks.
- Security hardening checklist.

Files likely affected:

- `Dockerfile`
- `docker-compose.prod.yml`
- deployment docs
- `app/api/health/route.ts`
- environment templates

Risks:

- Secrets leakage.
- Missing backups.
- Unpatched server dependencies.
- Inadequate monitoring.
- File storage and database colocation risks.

Completion criteria:

- App deploys from a clean checkout.
- Database migrations run predictably.
- TLS works.
- Backups are tested.
- Health checks and logs are usable.

## Phase 12: Future Creator Marketplace

Goal:

- Allow approved third-party creators to publish and sell games.
- Do not enable outside creators until the internal Game Builder Wizard, conditional reveal engine, first-party commerce, support, security, and production operations are stable.

Deliverables:

- Creator profiles.
- Creator game ownership.
- Publishing approval workflow.
- Marketplace reviews.
- Revenue split and payout planning.
- Content moderation tools.

Files likely affected:

- `app/creator/**`
- `app/admin/approvals/**`
- `app/marketplace/**`
- `prisma/schema.prisma`
- `app/lib/services/marketplace.ts`
- `app/lib/services/payouts.ts`

Risks:

- Legal, tax, and payout complexity.
- Quality control and moderation load.
- Spoiler and IP protection.
- Marketplace scale changes support expectations.
- Creator-authored conditional rules increase validation and support burden.

Completion criteria:

- Creator can submit game for review.
- Admin can approve/reject.
- Approved games can be sold.
- Revenue shares and payouts are tracked only after the marketplace payment/payout plan is intentionally implemented.
