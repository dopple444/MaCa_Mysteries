# Testing

Last updated: 2026-05-21

## Test Database

Automated database tests should not share normal local development data. The test runner now uses `DATABASE_URL_TEST` when it is available. If `DATABASE_URL_TEST` is not set, it derives a test database by appending `_test` to `DATABASE_URL`.

Current local derived database:

```text
maca_mysteries_test
```

Prepare or refresh the test database:

```bash
npm run test:prepare
```

This creates the test database if needed, runs Prisma migrations against it, and regenerates the Prisma client.

## Standard Test Run

Run isolated automated tests:

```bash
npm test
```

Without `TEST_BASE_URL`, route tests that require a running browser-accessible app are skipped. Database-backed tests use the test database.

## Live Route Test Run

When the local dev server is already running on port `3001`, run:

```bash
TEST_BASE_URL=http://127.0.0.1:3001 npm test
```

When `TEST_BASE_URL` is set, tests intentionally use the normal `DATABASE_URL` so direct fixture setup and the running app server read the same database.

## Raw Node Test Runner

The original raw command remains available:

```bash
npm run test:raw
```

Use it only when debugging the wrapper itself.
