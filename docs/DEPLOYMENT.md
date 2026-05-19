# Deployment Notes

Last updated: 2026-05-19

The current live development server still runs directly on Ubuntu at `http://192.168.2.45:3001`. Docker production scaffolding has been added, but the running server has not been switched to Docker.

## Current Local Server

```bash
cd /home/dopple444/projects/MaCa_Mysteries
npm run dev -- -H 0.0.0.0 -p 3001
```

## Production Docker Files

- `Dockerfile`
- `docker-compose.prod.yml`
- `.dockerignore`

The production Compose stack includes:

- `app`: Next.js application
- `db`: PostgreSQL 16
- `maca_postgres_data`: persistent database volume

## Build And Start Docker Stack

Use this only when intentionally testing Docker deployment:

```bash
cd /home/dopple444/projects/MaCa_Mysteries
POSTGRES_PASSWORD='replace-with-a-real-secret' docker compose -f docker-compose.prod.yml up --build -d
```

The app container runs:

```bash
npx prisma migrate deploy
npx next start -H 0.0.0.0 -p ${PORT:-3000}
```

## Required Production Variables

- `POSTGRES_PASSWORD`
- `DATABASE_URL` if not using the Compose-provided default
- `APP_PORT` if the host port should not be `3001`

Provider variables are still optional until real integrations are enabled:

- `PAYMENT_PROVIDER`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `EMAIL_PROVIDER`
- `EMAIL_API_KEY`
- `SMS_PROVIDER`
- `SMS_API_KEY`
- object storage variables listed in `docs/ENVIRONMENT.md`

## Cutover Checklist

1. Back up the current PostgreSQL database.
2. Confirm migrations pass with `npx prisma migrate deploy`.
3. Build the Docker image.
4. Start Docker stack on a non-conflicting port first.
5. Run live tests against the Docker URL.
6. Confirm `/`, `/games`, `/support`, and `/admin` responses.
7. Stop the direct dev server only after Docker smoke tests pass.
8. Update firewall/reverse-proxy rules.
9. Document the exact cutover time and rollback command.

## Rollback

If Docker cutover fails, stop the Compose stack:

```bash
docker compose -f docker-compose.prod.yml down
```

Then restart the current direct server:

```bash
cd /home/dopple444/projects/MaCa_Mysteries
npm run dev -- -H 0.0.0.0 -p 3001
```
