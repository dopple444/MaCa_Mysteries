# Screen Inventory

Last inspected: 2026-05-18

## Summary

This app currently contains a small set of Next.js App Router screens. The routes cover public landing/catalog pages, host account auth, basic host dashboard, basic party creation, basic party guest management, and a guest join shell.

No screen currently imports or calls Base44.

## Screens

| Route | File path | Purpose | User type | Base44 dependencies | Likely backend data needed | Migration priority |
| --- | --- | --- | --- | --- | --- | --- |
| `/` | `app/page.tsx` | Public landing page for MaCa Mysteries with links to hosting and joining. | Public visitor, customer | None found | Site metadata, featured games, current product offers, CMS/marketing copy later | Medium |
| `/games` | `app/games/page.tsx` | Public catalog of first-party games. Reads published game records from PostgreSQL. | Public visitor, customer, host | None found | Published games, active game versions, pricing/product data, player counts, duration, hero media, availability | High |
| `/games/[slug]` | `app/games/[slug]/page.tsx` | Public detail page for a selected published game. Reads by slug from PostgreSQL. | Public visitor, customer, host | None found | Game by slug, published version summary, product/order eligibility, media, tags, player counts, duration, purchase/activation status | High |
| `/host` | `app/host/page.tsx` | Host experience intro with feature cards and links to catalog/join. | Public visitor, customer, host | None found | Optional featured games, authenticated host state, host's active parties later | Medium |
| `/host/create?game=slug` | `app/host/create/page.tsx` | Authenticated form to create a party for a selected game and add initial guest emails. | Host, customer | None found | Current user, selected game/version, purchase/activation entitlement, party defaults, invite settings | High |
| `/host/party/[partyId]` | `app/host/party/[partyId]/page.tsx` | Authenticated host party control view showing party details, invite code, guest list, and add-guest form. | Host | None found | Party, host ownership, guests, assignments, game/version details, round state, spoiler mode, evidence reveals, invite delivery state | High |
| `/join` | `app/join/page.tsx` | Guest join form. Preserves `?code=` but does not yet join a party. | Guest, player | None found | Party lookup by invite code, guest invite/token, join status, display name, contact info, assigned character, player session | High |
| `/login` | `app/login/page.tsx` | Host sign-in form. | Customer, host, admin later | None found | User by email, password hash, session creation, rate-limit state, account status | High |
| `/signup` | `app/signup/page.tsx` | Host registration form. | Customer, host | None found | User creation, duplicate email check, password hash, session creation, email verification later | High |
| `/dashboard` | `app/dashboard/page.tsx` | Authenticated host dashboard with welcome message, sign-out, and links. | Host, admin later | None found | Current user, parties, purchases/orders, upcoming events, admin role flags | High |

## API Route Inventory

| Route | File path | Purpose | User type | Base44 dependencies | Backend data needed | Migration priority |
| --- | --- | --- | --- | --- | --- | --- |
| `GET /api/health` | `app/api/health/route.ts` | Health check returning status and timestamp. | Support, ops, deployment checks | None found | Optional database connectivity, build version, dependency health later | Medium |
| `GET /api/games` | `app/api/games/route.ts` | Public-safe database-backed game list API. | Public visitor, customer, host, external client later | None found | Published games from database, product/pricing summary, media thumbnails | High |

## Missing Screens Expected For MVP

These screens are not present yet but are required or likely for the first complete product.

| Proposed route | Purpose | User type | Likely backend data needed | Priority |
| --- | --- | --- | --- | --- |
| `/checkout/[gameSlug]` or provider checkout redirect | Purchase a game or activate access. | Customer | Product, order, payment provider session | Must have before paid launch |
| `/account/orders` | View purchases and available game activations. | Customer, host | Orders, order items, products, game entitlements | Must have before paid launch |
| `/host/party/[partyId]/assignments` | Assign required and optional characters to guests. | Host | Party guests, game characters, assignment rules | Must have |
| `/host/party/[partyId]/rounds` | Host round controls with spoiler-safe mode and optional unlock. | Host | Party state, round state, spoiler rules, game version | Must have |
| `/play/[partyId]` or `/party/[partyId]/player` | Player party home and character view. | Player | Guest identity, assignment, visible cards, current round, private clues | Must have |
| `/play/[partyId]/round/[roundNumber]` | Player round card/clue screen. | Player | Round cards, clues, evidence, message reveals, privacy rules | Must have |
| `/play/[partyId]/accuse` | Submit accusation or final guess. | Player | Accusation prompts, available suspects, party round state | Should have |
| `/host/party/[partyId]/reveal` | Host final reveal control. | Host | Solution, killer/victim reveal rules, party accusations, result data | Must have |
| `/admin` | Admin home. | Admin | Role-gated operational metrics and content tasks | Should have |
| `/admin/games` | Manage first-party game catalog. | Admin | Games, versions, publishing status | Should have |
| `/admin/games/[gameId]/edit` | Edit game content. | Admin | Full game content model | Should have |
| `/support` | Contact/support ticket form. | Customer, host, player | Support ticket creation, order/party context | Could have |
| `/creator` | Creator portal landing. | Creator | Creator profile, creator games, approvals, payouts | Later |
| `/creator/games` | Creator game management. | Creator | Creator games, drafts, publishing approvals | Later |

## Data Access Notes By Screen

### Public Catalog And Detail

Current state:

- Uses PostgreSQL-backed `Game`, `GameVersion`, and `Product` records.
- Reads are centralized through `app/lib/games.ts`.
- Current public response intentionally exposes only non-spoiler catalog fields.

Target state:

- Continue using database-backed published game/version data.
- Show only public-safe metadata.
- Never expose spoiler content from catalog endpoints.

Priority:

- High, because purchases and party creation must reference stable database game records.

### Host Party Controls

Current state:

- Reads party/guests from Prisma.
- Verifies host owns party.
- Shows raw game slug but not game title/version.

Target state:

- Host dashboard should be backed by `party_instances`, `party_guests`, `party_character_assignments`, `party_round_state`, and spoiler-safe computed views.
- Host should get a safe summary by default and intentionally unlock spoiler mode when needed.

Priority:

- High, because this is the operational center of each event.

### Player Join And Play

Current state:

- Join form does not perform backend lookup or joining.

Target state:

- Guests can join by invite code/link.
- Guests are attached to a party and optionally to an existing invited email.
- The player session must expose only that player's allowed public/private content for the current round.

Priority:

- High, because the product cannot run a game until player flow exists.

### Admin Editing

Current state:

- No admin UI exists.

Target state:

- Admins can create first-party game content, version it, preview spoiler-protected material, and publish game versions.

Priority:

- Should have after game engine foundations. Early seed scripts or direct Prisma writes can temporarily stand in for a UI during internal development.
