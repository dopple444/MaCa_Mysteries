import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";

import { PrismaClient } from "@prisma/client";

import { checkRateLimit, deleteExpiredRateLimitBuckets } from "../app/lib/rate-limit";

const prisma = new PrismaClient();

test("checkRateLimit allows requests until the bucket limit is exceeded", async () => {
  const scope = `test-rate-${crypto.randomBytes(6).toString("hex")}`;
  const key = "USER@EXAMPLE.COM";

  try {
    const first = await checkRateLimit({ scope, key, limit: 2, windowSeconds: 60 });
    const second = await checkRateLimit({ scope, key, limit: 2, windowSeconds: 60 });
    const third = await checkRateLimit({ scope, key, limit: 2, windowSeconds: 60 });

    assert.equal(first.allowed, true);
    assert.equal(second.allowed, true);
    assert.equal(third.allowed, false);
    assert.equal(third.count, 3);

    const bucket = await prisma.rateLimitBucket.findFirstOrThrow({
      where: {
        scope,
        key: "user@example.com"
      }
    });
    assert.equal(bucket.count, 3);
  } finally {
    await prisma.rateLimitBucket.deleteMany({ where: { scope } });
  }
});

test("deleteExpiredRateLimitBuckets removes old buckets", async () => {
  const scope = `test-rate-expired-${crypto.randomBytes(6).toString("hex")}`;
  const now = new Date();
  await prisma.rateLimitBucket.create({
    data: {
      scope,
      key: "expired",
      windowStart: new Date(now.getTime() - 120_000),
      count: 1,
      expiresAt: new Date(now.getTime() - 60_000)
    }
  });

  try {
    const result = await deleteExpiredRateLimitBuckets(now);
    assert.ok(result.count >= 1);

    const remaining = await prisma.rateLimitBucket.count({ where: { scope } });
    assert.equal(remaining, 0);
  } finally {
    await prisma.rateLimitBucket.deleteMany({ where: { scope } });
  }
});
