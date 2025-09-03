export interface ICacheProvider {
  /**
   * Get a value from cache
   * @param key Cache key
   * @returns Cached value or null if not found
   */
  get<T>(key: string): Promise<T | null>;

  /**
   * Set a value in cache
   * @param key Cache key
   * @param value Value to cache
   * @param ttl Time to live in seconds (optional)
   */
  set(key: string, value: any, ttl?: number): Promise<void>;

  /**
   * Delete a key from cache
   * @param key Cache key to delete
   */
  delete(key: string): Promise<void>;

  /**
   * Check if a key exists in cache
   * @param key Cache key to check
   */
  exists(key: string): Promise<boolean>;

  /**
   * Invalidate cache entries matching a pattern
   * @param pattern Pattern to match keys (supports wildcards)
   */
  invalidate(pattern: string): Promise<void>;

  /**
   * Get multiple values from cache
   * @param keys Array of cache keys
   */
  mget<T>(keys: string[]): Promise<(T | null)[]>;

  /**
   * Set multiple values in cache
   * @param entries Array of key-value pairs with optional TTL
   */
  mset(entries: { key: string; value: any; ttl?: number }[]): Promise<void>;

  /**
   * Increment a numeric value in cache
   * @param key Cache key
   * @param increment Amount to increment by (default: 1)
   */
  increment(key: string, increment?: number): Promise<number>;

  /**
   * Set expiration time for a key
   * @param key Cache key
   * @param ttl Time to live in seconds
   */
  expire(key: string, ttl: number): Promise<boolean>;

  /**
   * Get remaining time to live for a key
   * @param key Cache key
   */
  ttl(key: string): Promise<number>;

  /**
   * Clear all cache entries
   */
  clear(): Promise<void>;

  /**
   * Close the cache connection
   */
  disconnect(): Promise<void>;
}

export interface CacheConfig {
  provider: 'redis' | 'memory' | 'azure_redis';
  host?: string;
  port?: number;
  password?: string;
  database?: number;
  connectionString?: string;
  keyPrefix?: string;
  defaultTTL?: number;
  maxMemoryMB?: number; // For memory provider
}

export interface CacheEntry<T = any> {
  key: string;
  value: T;
  ttl?: number;
  createdAt: Date;
  expiresAt?: Date;
}