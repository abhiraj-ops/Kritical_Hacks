/**
 * In-memory LRU with TTL.
 *
 * Two jobs, both about protecting our TinyFish budget:
 *  1. Repeat claims return instantly — good demo UX, zero API spend.
 *  2. Research runs (5/day in beta) are memoised by claim hash so judges
 *     re-running a demo claim don't burn the daily allowance.
 *
 * Serverless caveat: this is per-instance. Fine for a hackathon demo; in
 * production you'd swap the Map for Vercel KV. We say so in the README.
 */

export class LRUCache<T> {
  private map = new Map<string, { value: T; expires: number }>();

  constructor(
    private readonly max = 200,
    private readonly ttlMs = 10 * 60_000,
  ) {}

  get(key: string): T | undefined {
    const entry = this.map.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expires) {
      this.map.delete(key);
      return undefined;
    }
    // Re-insert to mark as most-recently-used.
    this.map.delete(key);
    this.map.set(key, entry);
    return entry.value;
  }

  set(key: string, value: T): void {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, { value, expires: Date.now() + this.ttlMs });
    while (this.map.size > this.max) {
      const oldest = this.map.keys().next();
      if (oldest.done) break;
      this.map.delete(oldest.value);
    }
  }

  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  get size(): number {
    return this.map.size;
  }
}

/** FNV-1a 32-bit — stable, fast, and good enough to key a cache. */
export function claimKey(claim: string): string {
  const normalised = claim.trim().toLowerCase().replace(/\s+/g, " ");
  let hash = 0x811c9dc5;
  for (let i = 0; i < normalised.length; i++) {
    hash ^= normalised.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `${hash.toString(16)}-${normalised.length}`;
}

/** Process-wide singletons (survive hot reloads in dev). */
export const verdictCache = new LRUCache<unknown>(200, 15 * 60_000);
export const researchRunCache = new LRUCache<string>(100, 24 * 60 * 60_000);
