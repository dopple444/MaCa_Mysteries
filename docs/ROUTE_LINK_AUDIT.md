# Route And Link Audit

Last inspected: 2026-05-18

## Summary

The visible public navigation and catalog links are currently routing correctly on the local dev server at:

- `http://192.168.2.45:3001`
- `http://127.0.0.1:3001`

Database configuration is now present for local development:

- `.env` points at the local PostgreSQL database `maca_mysteries`.
- Prisma migrations have been applied.
- Public catalog reads now depend on seeded `Game`, `GameVersion`, and `Product` records.

## Server State

Initial route probes returned `500` for every route because the existing Next dev server had a stale/corrupt `.next` cache:

- Error: `Cannot find module './331.js'`
- Source: `.next/server/webpack-runtime.js`

Clearing `.next` resolved that stale build issue. The app then compiled and served routes successfully.

## Verified Routes

| Route | Result | Notes |
| --- | --- | --- |
| `/` | `200 OK` | Public home page renders. |
| `/host` | `200 OK` | Public host information page renders. |
| `/join` | `200 OK` | Guest join shell renders. Form does not yet perform backend join. |
| `/games` | `200 OK` | Public database-backed catalog renders. |
| `/games/the-last-curtain` | `200 OK` | Game detail route renders. |
| `/games/murder-at-hollow-lake` | `200 OK` | Game detail route renders. |
| `/games/not-a-real-game` | `404 Not Found` | Expected behavior from `notFound()`. |
| `/login` | `200 OK` | Login page renders. Server action depends on Prisma. |
| `/signup` | `200 OK` | Signup page renders. Server action depends on Prisma. |
| `/dashboard` | `307 Temporary Redirect` | Expected unauthenticated redirect to `/login`. |
| `/host/create?game=the-last-curtain` | `307 Temporary Redirect` | Expected unauthenticated redirect to `/login`. |
| `/api/health` | `200 OK` | Returns JSON status and timestamp. |
| `/api/games` | `200 OK` | Returns public-safe database-backed JSON game list. |

## Link Inventory

| Source | Link target | Status | Notes |
| --- | --- | --- | --- |
| `app/layout.tsx` | `/` | OK | Header brand link. |
| `app/layout.tsx` | `/host` | OK | Public host page. |
| `app/layout.tsx` | `/join` | OK | Join shell. |
| `app/layout.tsx` | `/games` | OK | Catalog page. |
| `app/page.tsx` | `/host` | OK | CTA says `Host dashboard`, but it actually opens public host intro page. Copy may need adjustment later. |
| `app/page.tsx` | `/join` | OK | Public join shell. |
| `app/host/page.tsx` | `/games` | OK | Catalog CTA. |
| `app/host/page.tsx` | `/join` | OK | Join CTA. |
| `app/games/page.tsx` | `/games/the-last-curtain` | OK | Dynamic game detail route. |
| `app/games/page.tsx` | `/games/murder-at-hollow-lake` | OK | Dynamic game detail route. |
| `app/games/[slug]/page.tsx` | `/host/create?game=slug` | OK, auth-gated | Redirects to `/login` when unauthenticated. |
| `app/games/[slug]/page.tsx` | `/host` | OK | Button text says `Invite guests`, but it routes to the host intro page. Copy/target likely needs refinement later. |
| `app/login/page.tsx` | `/signup` | OK | Signup page renders. |
| `app/signup/page.tsx` | `/login` | OK | Login page renders. |
| `app/dashboard/page.tsx` | `/host` | OK | Dashboard requires auth first. |
| `app/dashboard/page.tsx` | `/games` | OK | Dashboard requires auth first. |
| `app/host/party/[partyId]/page.tsx` | `/join?code=INVITECODE` | OK shell only | Join page pre-fills code but does not yet look up party or join guest. |

## Action/Form Status

| Form/action | Current status | Blocker |
| --- | --- | --- |
| Login | Page renders. Action uses Prisma. | Requires an existing user account. |
| Signup | Page renders. Action uses Prisma. | No current setup blocker found. |
| Logout | Requires active session. | Depends on session table. |
| Create party | Route redirects to login when unauthenticated. Action uses Prisma and validates the selected published game. | Requires auth session. |
| Add guest | Present on party detail page. Action uses Prisma and verifies party ownership. | Requires auth session and existing owned party. |
| Join party | Shell only. | No server action or route handler implemented yet. |

## Build Check

`npm run build` initially failed while the dev server/cache was in a bad state:

- Failure point: page data collection for `/_not-found`

After clearing the stale `.next` output and rerunning:

- `npx next build --debug` completed successfully.
- All current app routes were included in the build output.

## Next Fixes Before More Link Testing

1. Restore/fix the local Git repository state.
2. Create a local `.env` from `.env.example`.
3. Set `DATABASE_URL` for the intended PostgreSQL database.
4. Run Prisma validate/generate/migrate against the confirmed database.
5. Create a seed host account or use signup after migrations are in place.
6. Re-test the authenticated flow:
   - `/signup`
   - `/dashboard`
   - `/games/the-last-curtain`
   - `/host/create?game=the-last-curtain`
   - `/host/party/[partyId]`
   - `/join?code=INVITECODE`
