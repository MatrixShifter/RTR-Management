import { logger } from '../logger.js';

interface CacheEntry<T = any> {
  data: T;
  expiresAt: number;
}

class CacheService {
  private memoryStore = new Map<string, CacheEntry>();
  private defaultTtlMs = 60 * 1000; // 60 seconds

  constructor() {
    // Periodic sweep of expired memory keys every 30 seconds
    setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.memoryStore.entries()) {
        if (now > entry.expiresAt) {
          this.memoryStore.delete(key);
        }
      }
    }, 30 * 1000).unref();
  }

  /**
   * Retrieves an item from cache. Returns null if missing or expired.
   */
  async get<T = any>(key: string): Promise<T | null> {
    try {
      const entry = this.memoryStore.get(key);
      if (!entry) return null;

      if (Date.now() > entry.expiresAt) {
        this.memoryStore.delete(key);
        return null;
      }

      return entry.data as T;
    } catch (err) {
      logger.warn('Cache get error, bypassing cache:', { error: String(err) });
      return null;
    }
  }

  /**
   * Sets an item in cache with specified TTL in milliseconds.
   */
  async set<T = any>(key: string, data: T, ttlMs = this.defaultTtlMs): Promise<void> {
    try {
      this.memoryStore.set(key, {
        data,
        expiresAt: Date.now() + ttlMs
      });
    } catch (err) {
      logger.warn('Cache set error:', { error: String(err) });
    }
  }

  /**
   * Invalidates a single key or all keys matching a prefix.
   */
  async invalidate(pattern: string): Promise<void> {
    try {
      for (const key of this.memoryStore.keys()) {
        if (key === pattern || key.startsWith(pattern)) {
          this.memoryStore.delete(key);
        }
      }
    } catch (err) {
      logger.warn('Cache invalidation error:', { error: String(err) });
    }
  }

  /**
   * Clears all cached items.
   */
  async clear(): Promise<void> {
    this.memoryStore.clear();
  }
}

export const cacheService = new CacheService();
