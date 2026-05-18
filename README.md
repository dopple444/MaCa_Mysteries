# MaCa Mysteries

A new murder mystery party platform scaffold for Burnett Games.

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Prisma (PostgreSQL)

## Getting started

1. Copy `.env.example` to `.env`
2. Install dependencies:
   ```bash
   npm install
   ```
3. Generate Prisma client and create the database schema:
   ```bash
   npx prisma migrate dev --name init
   ```
4. Run the development server:
   ```bash
   npm run dev
   ```

## Available routes

- `/` - Landing page
- `/host` - Host landing page
- `/join` - Guest join page
- `/login` - Host sign in
- `/signup` - Host registration
- `/dashboard` - Host dashboard
- `/games` - Game catalog
- `/games/[slug]` - Game detail page
- `/api/health` - health check endpoint

## Notes

This scaffold is intentionally minimal. It provides the foundation for building a host/player murder mystery experience with a self-hosted backend.
