import "server-only";

import { NextResponse } from "next/server";

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

type GlobalRateLimitStore = typeof globalThis & {
  __monitoringRateLimitStore?: Map<string, RateLimitEntry>;
};

type RateLimitConfig = {
  max: number;
  windowMs: number;
  key?: string;
};

type RateLimitResult = {
  ok: boolean;
  retryAfterSec: number;
  remaining: number;
};

function getStore() {
  const globalStore = globalThis as GlobalRateLimitStore;
  if (!globalStore.__monitoringRateLimitStore) {
    globalStore.__monitoringRateLimitStore = new Map<string, RateLimitEntry>();
  }
  return globalStore.__monitoringRateLimitStore;
}

function pruneExpiredEntries(store: Map<string, RateLimitEntry>, now: number) {
  if (store.size < 5_000) return;
  for (const [key, entry] of store.entries()) {
    if (entry.resetAt <= now) {
      store.delete(key);
    }
  }
}

export function getClientIp(req: Request) {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const [first] = forwardedFor.split(",");
    if (first?.trim()) return first.trim();
  }

  const realIp = req.headers.get("x-real-ip");
  if (realIp?.trim()) return realIp.trim();

  return "unknown";
}

export function checkRateLimit(
  req: Request,
  namespace: string,
  config: RateLimitConfig,
): RateLimitResult {
  const now = Date.now();
  const store = getStore();
  pruneExpiredEntries(store, now);

  const identity = config.key?.trim() || getClientIp(req);
  const storageKey = `${namespace}:${identity}`;
  const current = store.get(storageKey);

  if (!current || current.resetAt <= now) {
    store.set(storageKey, { count: 1, resetAt: now + config.windowMs });
    return {
      ok: true,
      retryAfterSec: 0,
      remaining: Math.max(0, config.max - 1),
    };
  }

  current.count += 1;
  store.set(storageKey, current);

  if (current.count > config.max) {
    return {
      ok: false,
      retryAfterSec: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
      remaining: 0,
    };
  }

  return {
    ok: true,
    retryAfterSec: 0,
    remaining: Math.max(0, config.max - current.count),
  };
}

export function rateLimitResponse(result: RateLimitResult) {
  return NextResponse.json(
    {
      ok: false,
      error: "RATE_LIMITED",
      retryAfterSec: result.retryAfterSec,
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(result.retryAfterSec),
        "Cache-Control": "no-store",
      },
    },
  );
}
