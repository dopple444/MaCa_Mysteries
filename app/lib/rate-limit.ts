import { prisma } from "./prisma";

type RateLimitInput = {
  scope: string;
  key: string;
  limit: number;
  windowSeconds: number;
};

function normalizeKey(key: string) {
  return key.trim().toLowerCase() || "anonymous";
}

export async function checkRateLimit(input: RateLimitInput) {
  const now = new Date();
  const windowMs = input.windowSeconds * 1000;
  const windowStart = new Date(Math.floor(now.getTime() / windowMs) * windowMs);
  const expiresAt = new Date(windowStart.getTime() + windowMs);
  const key = normalizeKey(input.key);

  const bucket = await prisma.rateLimitBucket.upsert({
    where: {
      scope_key_windowStart: {
        scope: input.scope,
        key,
        windowStart
      }
    },
    update: {
      count: { increment: 1 },
      expiresAt
    },
    create: {
      scope: input.scope,
      key,
      windowStart,
      expiresAt
    },
    select: {
      count: true,
      expiresAt: true
    }
  });

  return {
    allowed: bucket.count <= input.limit,
    count: bucket.count,
    limit: input.limit,
    resetAt: bucket.expiresAt
  };
}

export async function deleteExpiredRateLimitBuckets(now = new Date()) {
  return prisma.rateLimitBucket.deleteMany({
    where: {
      expiresAt: { lt: now }
    }
  });
}
