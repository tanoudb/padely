import { HttpError } from './http.js';

export function createRateLimiter({ windowMs, max, message = 'Rate limit exceeded' }) {
  const buckets = new Map();

  function consume(key, now = Date.now()) {
    const current = buckets.get(key) ?? { count: 0, windowStart: now };

    if (now - current.windowStart > windowMs) {
      current.count = 0;
      current.windowStart = now;
    }

    current.count += 1;
    buckets.set(key, current);

    if (current.count > max) {
      throw new HttpError(429, message, message);
    }

    return {
      count: current.count,
      remaining: Math.max(0, max - current.count),
      resetAt: current.windowStart + windowMs,
    };
  }

  function clear() {
    buckets.clear();
  }

  return {
    consume,
    clear,
    size: () => buckets.size,
  };
}
