# Deployment Notes

Last updated: 2026-05-22

The current live development server still runs directly on Ubuntu at `http://192.168.2.45:3001` and is exposed for staging through Cloudflare Tunnel at `https://staging.macamysteries.com`. Docker production scaffolding has been added, but the running server has not been switched to Docker.

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
- `APP_URL`
- `CSRF_SECRET`
- `ACCOUNT_TOKEN_SECRET`
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

`NODE_ENV=production` now refuses to start if `APP_URL`, `CSRF_SECRET`, or `ACCOUNT_TOKEN_SECRET` are missing. `CSRF_SECRET` and `ACCOUNT_TOKEN_SECRET` must be strong non-placeholder values.

Generate staging secrets with:

```bash
openssl rand -hex 32
```

## Public Staging Path

The recommended public test path is:

1. Keep the current LAN dev server running until staging passes.
2. Route `staging.macamysteries.com` through Cloudflare Tunnel to the local app service, currently `http://localhost:3001`.
3. Create a staging environment file outside Git with at least:

`.env.*` files are ignored by Git, but keep staging/live env files out of commits and do not paste provider secrets into docs or chat.

```bash
APP_URL="https://staging.macamysteries.com"
APP_PORT="3002"
POSTGRES_PASSWORD="replace-with-a-real-database-password"
CSRF_SECRET="replace-with-openssl-rand-hex-32"
ACCOUNT_TOKEN_SECRET="replace-with-a-different-openssl-rand-hex-32"
PAYMENT_PROVIDER="stripe"
STRIPE_SECRET_KEY="sk_test_replace_me"
STRIPE_WEBHOOK_SECRET="whsec_replace_me"
EMAIL_PROVIDER="resend"
EMAIL_API_KEY="replace_me"
EMAIL_FROM="MaCa Mysteries <onboarding@resend.dev>"
```

4. Validate the Compose config without starting services:

```bash
docker compose --env-file /path/to/staging.env -f docker-compose.prod.yml config
```

5. Start on a non-conflicting port first:

```bash
docker compose --env-file /path/to/staging.env -f docker-compose.prod.yml up --build -d
```

6. Run migrations and health checks through the app container logs. The app container runs `npx prisma migrate deploy` before `next start`.
7. For Docker staging, move the Cloudflare Tunnel service target from `http://localhost:3001` to the Docker app port, for example `http://localhost:3002`. A traditional Nginx/Caddy/Apache reverse proxy can still be used later for a data-center deployment.
8. Run:

```bash
TEST_BASE_URL=https://staging.macamysteries.com npm test
```

9. Keep Stripe in test mode and Resend in the temporary sender mode until the public staging flow is proven.

### Reverse Proxy Shape

The reverse proxy should terminate HTTPS and forward to the local app port. A minimal Nginx location shape is:

```nginx
location / {
  proxy_pass http://127.0.0.1:3002;
  proxy_http_version 1.1;
  proxy_set_header Host $host;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto https;
}
```

Do not expose the database port publicly.

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
