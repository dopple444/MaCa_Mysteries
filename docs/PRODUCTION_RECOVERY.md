# Production Recovery Notes

Last updated: 2026-05-19

These notes cover the current Ubuntu-server development deployment. They are not a final production runbook yet, but they capture the recovery commands and checks that are currently useful.

## Current Services

- App: Next.js dev server on port `3001`
- Current reachable URL: `http://192.168.2.45:3001`
- Database: PostgreSQL in Docker, expected on `localhost:5432`
- Project path: `/home/dopple444/projects/MaCa_Mysteries`

## Check App Status

```bash
cd /home/dopple444/projects/MaCa_Mysteries
ss -ltnp 'sport = :3001'
curl -I --max-time 5 http://127.0.0.1:3001/
curl -I --max-time 5 http://192.168.2.45:3001/
```

Expected:

- Port `3001` is listening on `0.0.0.0`.
- `/` returns `200`.
- `/games` returns `200`.
- `/admin` redirects unauthenticated users to `/login`.

## Restart App

Stop anything currently listening on port `3001`:

```bash
cd /home/dopple444/projects/MaCa_Mysteries
kill $(ss -ltnp 'sport = :3001' | sed -n 's/.*pid=\([0-9]*\).*/\1/p') 2>/dev/null || true
```

Start the app:

```bash
cd /home/dopple444/projects/MaCa_Mysteries
npm run dev -- -H 0.0.0.0 -p 3001
```

For now this is intentionally still a dev-server workflow. A production `next start` or process-manager setup should wait until the deployment plan is finalized.

## Check PostgreSQL

```bash
docker ps
docker logs projects-db-1 --tail 100
```

If the container is stopped, restart it from the Compose project that owns it:

```bash
cd /home/dopple444/projects
docker compose up -d db
```

If the Compose service name changes, inspect `docker ps --a` and the local Compose file before restarting.

## Apply Migrations

```bash
cd /home/dopple444/projects/MaCa_Mysteries
npx prisma migrate deploy
npx prisma generate
```

Use `migrate deploy` on deployed environments. Avoid `prisma migrate dev` against production-like data.

## Seed Recovery

The seed currently restores first-party sample games, characters, rounds, cards, evidence, media, final reveals, and products.

```bash
cd /home/dopple444/projects/MaCa_Mysteries
npm run prisma:seed
```

Run seed only when you intentionally want to upsert the first-party sample content. It should not be treated as a database restore.

## Verification Commands

```bash
cd /home/dopple444/projects/MaCa_Mysteries
npx prisma format
npx prisma migrate deploy
npx prisma generate
npm test
./node_modules/.bin/tsc --noEmit
rm -rf .next && npm run build
TEST_BASE_URL=http://127.0.0.1:3001 npm test
```

The live test command requires the app server to already be running on port `3001`.

## Database Backup

Before risky migrations or deployment changes, create a timestamped dump:

```bash
npm run backup:db
```

The script loads `.env`, writes a custom-format `pg_dump` file under `DATABASE_BACKUP_DIR` or `/home/dopple444/backups/maca_mysteries`, and avoids printing the database URL. If host `pg_dump` is not installed, it can fall back to a running Postgres Docker container. Set `DATABASE_BACKUP_DOCKER_CONTAINER` if auto-detection picks the wrong container.

Preferred prerequisite: the server should have PostgreSQL client tools installed so `pg_dump` and `pg_restore` are available. On Ubuntu, install them with `sudo apt install postgresql-client`.

## Database Restore Drill

Do not restore over a live database casually. For a drill, restore into a separate database first:

```bash
npm run backup:restore-drill -- /path/to/backup.dump
```

If no backup file is passed, the script restores the latest `DATABASE_BACKUP_PREFIX_*.dump` file from `DATABASE_BACKUP_DIR`. It drops and recreates only the configured drill database, refuses to use the source database name, requires the drill database name to include `restore` or `drill`, runs `pg_restore`, and checks Prisma migration status against the restored database. If host PostgreSQL client tools are missing, it can fall back to a running Postgres Docker container.

Optional environment:

```bash
DATABASE_RESTORE_DRILL_DATABASE=maca_mysteries_restore_drill
DATABASE_RESTORE_SOURCE=/path/to/backup.dump
```

After restore, run read-only smoke checks before trusting the backup. Drop the drill database when you no longer need it.

## Immediate Incident Checklist

1. Confirm whether the app or database is down.
2. Check `ss -ltnp 'sport = :3001'`.
3. Check `docker ps` and Postgres logs.
4. Check app logs from the active terminal/session.
5. Restart the app if only the Next server is down.
6. Restart Postgres only if the database container is stopped or unhealthy.
7. Run `curl` checks for `/`, `/games`, `/support`, and `/admin`.
8. Run live tests when the app is back.
9. Record what failed, the command used to recover, and the exact time.
10. Create a backup before any corrective migration or manual data change.
