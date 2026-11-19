/** Small in-memory fixed-window limiter. Single-instance only; swap for a shared store when scaling out. */
export class RateLimiter {
  private readonly hits = new Map<string, { count: number; resetAt: number }>();
  constructor(private readonly max: number, private readonly windowMs: number) {}
  private entry(key: string) {
    const now = Date.now();
    const e = this.hits.get(key);
    if (!e || e.resetAt <= now) { const n = { count: 0, resetAt: now + this.windowMs }; this.hits.set(key, n); return n; }
    return e;
  }
  blocked(key: string) { return this.entry(key).count >= this.max; }
  fail(key: string) { this.entry(key).count++; if (this.hits.size > 10_000) this.gc(); }
  reset(key: string) { this.hits.delete(key); }
  private gc() { const now = Date.now(); for (const [k, v] of this.hits) if (v.resetAt <= now) this.hits.delete(k); }
}
