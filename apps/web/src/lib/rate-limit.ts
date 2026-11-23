import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { HttpError } from './http';

/**
 * Sliding-window limiter. Uses Upstash Redis when configured (REQUIRED in production on
 * serverless, because in-memory counters are per-instance and reset on cold start).
 */
const hasRedis = Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
const redis = hasRedis ? Redis.fromEnv() : null;
const limiters = new Map<string, Ratelimit>();
const memory = new Map<string, { count: number; resetAt: number }>();

export async function rateLimit(bucket: string, key: string, max: number, windowSec: number) {
  const id = `${bucket}:${key}`;
  let success = true;
  let retryAfter = windowSec;

  if (redis) {
    const cfg = `${bucket}:${max}:${windowSec}`;
    let rl = limiters.get(cfg);
    if (!rl) {
      rl = new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(max, `${windowSec} s`),
        prefix: `rl:${bucket}`,
      });
      limiters.set(cfg, rl);
    }
    const r = await rl.limit(key);
    success = r.success;
    retryAfter = Math.max(1, Math.ceil((r.reset - Date.now()) / 1000));
  } else {
    if (process.env.NODE_ENV === 'production') {
      console.warn('[rate-limit] UPSTASH_* not set — using per-instance memory limiter (not reliable on serverless)');
    }
    const now = Date.now();
    const entry = memory.get(id);
    if (!entry || entry.resetAt < now) {
      memory.set(id, { count: 1, resetAt: now + windowSec * 1000 });
    } else {
      entry.count += 1;
      success = entry.count <= max;
      retryAfter = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
    }
  }

  if (!success) {
    throw new HttpError(429, 'Too many requests. Please slow down and try again shortly.', 'RATE_LIMITED', {
      'Retry-After': String(retryAfter),
    });
  }
}
