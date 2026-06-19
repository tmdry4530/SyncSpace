/**
 * Minimal in-memory fixed-window rate limiter. Adequate for a single API
 * replica; multi-replica deployments should swap in a shared store (Redis).
 */
export class RateLimiter {
  private readonly hits = new Map<string, { count: number; resetAt: number }>()
  private lastSweep = 0

  constructor(
    private readonly windowMs: number,
    private readonly max: number
  ) {}

  /** Returns true if the action is allowed (and records the hit). */
  check(key: string, now = Date.now()): boolean {
    this.sweep(now)
    const entry = this.hits.get(key)
    if (!entry || entry.resetAt <= now) {
      this.hits.set(key, { count: 1, resetAt: now + this.windowMs })
      return true
    }
    if (entry.count >= this.max) return false
    entry.count += 1
    return true
  }

  private sweep(now: number): void {
    if (now - this.lastSweep < this.windowMs) return
    this.lastSweep = now
    for (const [key, entry] of this.hits) {
      if (entry.resetAt <= now) this.hits.delete(key)
    }
  }
}

/** Tracks concurrent long-lived connections (e.g. SSE streams) per key. */
export class ConcurrencyLimiter {
  private readonly active = new Map<string, number>()

  constructor(private readonly max: number) {}

  /** Acquire a slot; returns a release fn, or null when the limit is reached. */
  acquire(key: string): (() => void) | null {
    const current = this.active.get(key) ?? 0
    if (current >= this.max) return null
    this.active.set(key, current + 1)
    let released = false
    return () => {
      if (released) return
      released = true
      const next = (this.active.get(key) ?? 1) - 1
      if (next <= 0) this.active.delete(key)
      else this.active.set(key, next)
    }
  }
}
