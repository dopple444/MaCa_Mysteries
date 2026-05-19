# Screen Inventory

Last inspected: 2026-05-19

## Summary

The app is a Next.js App Router application with public catalog pages, host/customer auth, host party controls, guest join/play, support intake, notification settings, and role-gated admin operations. No screen currently imports or calls Base44.

## Screens

| Route | File path | Purpose | User type | Base44 dependencies | Backend data needed | Migration priority |
| --- | --- | --- | --- | --- | --- | --- |
| `/` | `app/page.tsx` | Public landing page for MaCa Mysteries with links to hosting and joining. | Public visitor, customer | None found | Site metadata, featured games, current product offers, CMS/marketing copy later | Medium |
| `/games` | `app/games/page.tsx` | Public catalog of published first-party games. | Public visitor, customer, host | None found | Published games, published versions, product/pricing summary | High |
| `/games/[slug]` | `app/games/[slug]/page.tsx` | Public game detail with active product purchase form and start-party link. | Public visitor, customer, host | None found | Game by slug, published version summary, active product, CSRF token for checkout form | High |
| `/login` | `app/login/page.tsx` | Sign-in form. | Customer, host, admin | None found | User by email, password hash, session creation, rate-limit state, CSRF token | High |
| `/signup` | `app/signup/page.tsx` | Registration form. | Customer, host | None found | User creation, duplicate email check, password hash, session creation, rate-limit state, CSRF token | High |
| `/dashboard` | `app/dashboard/page.tsx` | Authenticated dashboard with links to host, catalog, notifications, and sign-out. | Host, admin | None found | Current user, CSRF token | High |
| `/account/orders` | `app/account/orders/page.tsx` | Account order history and active game access page. | Customer, host, admin | None found | Current user, orders, order items, products/games, active game access | Should have |
| `/account/notifications` | `app/account/notifications/page.tsx` | Account email/SMS preference form. | Customer, host, admin | None found | Current user phone number, notification preferences, CSRF token | Should have |
| `/host` | `app/host/page.tsx` | Host experience entry point. | Public visitor, customer, host | None found | Optional featured games, authenticated state later | Medium |
| `/host/create?game=slug` | `app/host/create/page.tsx` | Authenticated party creation for a selected game. | Host, customer | None found | Current user, selected game/version, purchase/access check, guest invite parsing, CSRF token | High |
| `/host/party/[partyId]` | `app/host/party/[partyId]/page.tsx` | Host party control surface for guests, assignments, rounds, evidence, media, accusations, reveal controls, activity, and party completion. | Host | None found | Party ownership, guests, assignments, game version, rounds/cards, evidence, media, accusations, final reveal state, party result, audit log, CSRF token | High |
| `/join` | `app/join/page.tsx` | Guest join form and pending/joined entry flow. | Guest, player | None found | Party by invite code, guest invite/token, join status, rate-limit state, guest cookie, CSRF token | High |
| `/play` | `app/play/page.tsx` | Player party home with assigned character, active cards, evidence, media, accusation form, victim reveal, and final reveal content. | Player | None found | Guest cookie, guest/party/assignment, active rounds, visible cards, visible evidence/media, accusations, reveal state, CSRF token | High |
| `/support` | `app/support/page.tsx` | Public/account support ticket form. | Customer, host, player, public visitor | None found | Current user if logged in, ticket creation, rate-limit state, CSRF token | Should have |
| `/admin` | `app/admin/page.tsx` | Admin operational inventory with games, totals, activity, recent orders, outbound messages, support queue, filters, and retry/status controls. | Admin | None found | Admin user, games/products/versions, counts, audit logs, orders, outbound messages, support tickets, CSRF token | High |
| `/admin/games/new` | `app/admin/games/new/page.tsx` | Create first-party draft game and initial draft version/product shell. | Admin/content editor later | None found | Admin user, CSRF token | Should have |
| `/admin/games/[gameId]` | `app/admin/games/[gameId]/page.tsx` | Admin game detail and metadata/version status control. | Admin/content editor later | None found | Game, products, versions, characters, rounds, cards, evidence, media, final reveal, CSRF token | High |
| `/admin/orders/[orderId]` | `app/admin/orders/[orderId]/page.tsx` | Admin order detail with items, access grants, and webhook event history. | Admin/finance later | None found | Order, user, order items, products/games, access grants, webhook events | Should have |
| `/admin/support/[ticketId]` | `app/admin/support/[ticketId]/page.tsx` | Admin support ticket detail and status controls. | Admin/support later | None found | Support ticket, user context, CSRF token | Should have |

## Route Handler Inventory

| Route | File path | Purpose | User type | Base44 dependencies | Backend data needed | Migration priority |
| --- | --- | --- | --- | --- | --- | --- |
| `GET /api/health` | `app/api/health/route.ts` | Health check returning status and timestamp. | Support, ops, deployment checks | None found | Optional database/dependency health later | Medium |
| `GET /api/games` | `app/api/games/route.ts` | Public-safe game list API. | Public visitor, customer, host, future external client | None found | Published games from database | High |
| `POST /checkout/start` | `app/checkout/start/route.ts` | Starts purchase flow. Redirects hosts with access, otherwise creates a pending order and Stripe checkout session if configured. | Customer, host | None found | Current user, product, game access, order, rate-limit state, CSRF token, Stripe config | High |
| `POST /api/webhooks/payments/stripe` | `app/api/webhooks/payments/stripe/route.ts` | Verifies Stripe webhook signature, records events idempotently, marks paid orders, and grants access. | Stripe, ops | None found | Raw webhook body, signature secret, order, webhook event, access grant | Must have before paid launch |
| `POST /host/party/[partyId]/assign` | `app/host/party/[partyId]/assign/route.ts` | Saves or clears character assignment. | Host | None found | Party ownership, guest, character, assignment uniqueness, CSRF token | High |
| `POST /host/party/[partyId]/round` | `app/host/party/[partyId]/round/route.ts` | Unlocks, starts, or completes rounds. | Host | None found | Party ownership, round state, CSRF token | High |
| `POST /host/party/[partyId]/evidence` | `app/host/party/[partyId]/evidence/route.ts` | Reveals or hides evidence. | Host | None found | Party ownership, evidence, reveal state, CSRF token | High |
| `POST /host/party/[partyId]/final-reveal` | `app/host/party/[partyId]/final-reveal/route.ts` | Reveals/hides victim and final solution content. | Host | None found | Party ownership, final reveal state, round gate checks, CSRF token | High |
| `POST /host/party/[partyId]/invite` | `app/host/party/[partyId]/invite/route.ts` | Requeues invitation email drafts for a guest. | Host | None found | Party ownership, guest, outbound message, CSRF token | Should have |
| `POST /host/party/[partyId]/status` | `app/host/party/[partyId]/status/route.ts` | Completes or reopens a party. | Host | None found | Party ownership, party result, CSRF token | High |
| `POST /play/accusation` | `app/play/accusation/route.ts` | Creates/updates a player's accusation. | Player | None found | Guest cookie, party state, active round, suspects, CSRF token | High |
| `POST /admin/games/create` | `app/admin/games/create/route.ts` | Creates a draft first-party game, version, and optional product. | Admin | None found | Admin user, CSRF token, game/product fields | Should have |
| `POST /admin/games/[gameId]/edit` | `app/admin/games/[gameId]/edit/route.ts` | Updates game metadata and audits the change. | Admin | None found | Admin user, game, CSRF token | Should have |
| `POST /admin/games/[gameId]/versions/[versionId]/status` | `app/admin/games/[gameId]/versions/[versionId]/status/route.ts` | Draft/publish/archive game versions. | Admin | None found | Admin user, game version, CSRF token | Should have |
| `POST /admin/support/[ticketId]/status` | `app/admin/support/[ticketId]/status/route.ts` | Updates support ticket status and audits the change. | Admin/support later | None found | Admin user, ticket, CSRF token | Should have |
| `POST /admin/outbound/[messageId]/retry` | `app/admin/outbound/[messageId]/retry/route.ts` | Requeues a failed outbound message and audits retry. | Admin/support later | None found | Admin user, outbound message, CSRF token | Should have |

## Missing Screens Expected For MVP Completion

| Proposed route | Purpose | User type | Likely backend data needed | Priority |
| --- | --- | --- | --- | --- |
| `/admin/games/[gameId]/characters` | Edit game characters. | Admin/content editor | Game version, characters, assignment rules | Should have |
| `/admin/games/[gameId]/rounds` | Edit rounds and cards. | Admin/content editor | Game version, rounds, cards, spoiler labels | Should have |
| `/admin/games/[gameId]/evidence` | Edit evidence and media metadata. | Admin/content editor | Game version, evidence, media, visibility rules | Should have |
| `/admin/media/uploads` | Upload and review media assets. | Admin/content editor | Storage provider, media policies, asset metadata | Should have after storage |
| `/admin/support/[ticketId]/reply` | Threaded support replies. | Admin/support | Support messages, email provider | Could have |
| `/creator` | Creator portal landing. | Creator | Creator profile, creator games, approvals, payouts | Later |
| `/creator/games` | Creator game management. | Creator | Creator games, drafts, publishing approvals | Later |

## Data Access Notes

- Public catalog/detail must expose only public-safe metadata and active product information.
- Host controls must remain spoiler-safe by default; admin pages are trusted spoiler-heavy views.
- Player `/play` must only expose content visible to the current guest, character assignment, active rounds, and reveal state.
- Checkout flow must remain provider-safe when credentials are missing and must use idempotent webhooks for fulfillment.
- Outbound messages are queued locally; real delivery should be added as provider adapters without changing gameplay code.
