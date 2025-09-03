// Fallback types for Redis when not installed
interface RedisClientType {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  setEx(key: string, seconds: number, value: string): Promise<void>;
  del(key: string | string[]): Promise<number>;
  exists(key: string): Promise<number>;
  keys(pattern: string): Promise<string[]>;
  mGet(keys: string[]): Promise<(string | null)[]>;
  multi(): any;
  incrBy(key: string, increment: number): Promise<number>;
  expire(key: string, seconds: number): Promise<boolean>;
  ttl(key: string): Promise<number>;
  flushDb(): Promise<void>;
  ping(): Promise<string>;
  info(): Promise<string>;
  on(event: string, callback: (...args: any[]) => void): void;
}

// Try to import Redis, fallback to mock if not available
let createClient: (config: any) => RedisClientType;
try {
  const redis = require('redis');
  createClient = redis.createClient;
} catch (error) {
  // Mock Redis client for development/testing when Redis is not installed
  createClient = (config: any) => ({
    connect: async () => console.log('Mock Redis: Connected'),
    disconnect: async () => console.log('Mock Redis: Disconnected'),
    get: async (key: string) => null,
    set: async (key: string, value: string) => {},
    setEx: async (key: string, seconds: number, value: string) => {},
    del: async (key: string | string[]) => 0,
    exists: async (key: string) => 0,
    keys: async (pattern: string) => [],
    mGet: async (keys: string[]) => keys.map(() => null),
    multi: () => ({ set: () => {}, setEx: () => {}, exec: async () => [] }),
    incrBy: async (key: string, increment: number) => increment,
    expire: async (key: string, seconds: number) => true,
    ttl: async (key: string) => -1,
    flushDb: async () => {},
    ping: async () => 'PONG',
    info: async () => 'Mock Redis Info',
    on: (event: string, callback: (...args: any[]) => void) => {},
  }) as RedisClientType;
}

import { ICacheProvider, CacheConfig } from './ICacheProvider.js';

export class RedisProvider implements ICacheProvider {
  private client: RedisClientType;
  private config: CacheConfig;
  private isConnected = false;

  constructor(config: CacheConfig) {
    this.config = config;
    this.client = createClient({
      socket: {
        host: config.host || 'localhost',
        port: config.port || 6379,
      },
      password: config.password,
      database: config.database || 0,
      ...(config.connectionString && { url: config.connectionString }),
    });

    this.client.on('error', (error: any) => {
      console.error('Redis Client Error:', error);
    });

    this.client.on('connect', () => {
      console.log('Connected to Redis');
      this.isConnected = true;
    });

    this.client.on('disconnect', () => {
      console.log('Disconnected from Redis');
      this.isConnected = false;
    });
  }

  private async ensureConnection(): Promise<void> {
    if (!this.isConnected) {
      try {
        await this.client.connect();
      } catch (error) {
        console.error('Failed to connect to Redis:', error);
        throw error;
      }
    }
  }

  private getKey(key: string): string {
    return this.config.keyPrefix ? `${this.config.keyPrefix}:${key}` : key;
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      await this.ensureConnection();
      const result = await this.client.get(this.getKey(key));
      return result ? JSON.parse(result) : null;
    } catch (error) {
      console.error('Redis get error:', error);
      return null;
    }
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    try {
      await this.ensureConnection();
      const serializedValue = JSON.stringify(value);
      const redisKey = this.getKey(key);
      
      if (ttl || this.config.defaultTTL) {
        await this.client.setEx(redisKey, ttl || this.config.defaultTTL!, serializedValue);
      } else {
        await this.client.set(redisKey, serializedValue);
      }
    } catch (error) {
      console.error('Redis set error:', error);
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.ensureConnection();
      await this.client.del(this.getKey(key));
    } catch (error) {
      console.error('Redis delete error:', error);
      throw error;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.ensureConnection();
      const result = await this.client.exists(this.getKey(key));
      return result === 1;
    } catch (error) {
      console.error('Redis exists error:', error);
      return false;
    }
  }

  async invalidate(pattern: string): Promise<void> {
    try {
      await this.ensureConnection();
      const searchPattern = this.getKey(pattern);
      const keys = await this.client.keys(searchPattern);
      
      if (keys.length > 0) {
        await this.client.del(keys);
      }
    } catch (error) {
      console.error('Redis invalidate error:', error);
      throw error;
    }
  }

  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    try {
      await this.ensureConnection();
      const redisKeys = keys.map(key => this.getKey(key));
      const results = await this.client.mGet(redisKeys);
      
      return results.map((result: any) => 
        result ? JSON.parse(result) : null
      );
    } catch (error) {
      console.error('Redis mget error:', error);
      return keys.map(() => null);
    }
  }

  async mset(entries: { key: string; value: any; ttl?: number }[]): Promise<void> {
    try {
      await this.ensureConnection();
      
      // Use pipeline for better performance
      const pipeline = this.client.multi();
      
      for (const entry of entries) {
        const redisKey = this.getKey(entry.key);
        const serializedValue = JSON.stringify(entry.value);
        
        if (entry.ttl || this.config.defaultTTL) {
          pipeline.setEx(redisKey, entry.ttl || this.config.defaultTTL!, serializedValue);
        } else {
          pipeline.set(redisKey, serializedValue);
        }
      }
      
      await pipeline.exec();
    } catch (error) {
      console.error('Redis mset error:', error);
      throw error;
    }
  }

  async increment(key: string, increment: number = 1): Promise<number> {
    try {
      await this.ensureConnection();
      return await this.client.incrBy(this.getKey(key), increment);
    } catch (error) {
      console.error('Redis increment error:', error);
      throw error;
    }
  }

  async expire(key: string, ttl: number): Promise<boolean> {
    try {
      await this.ensureConnection();
      const result = await this.client.expire(this.getKey(key), ttl);
      return result;
    } catch (error) {
      console.error('Redis expire error:', error);
      return false;
    }
  }

  async ttl(key: string): Promise<number> {
    try {
      await this.ensureConnection();
      return await this.client.ttl(this.getKey(key));
    } catch (error) {
      console.error('Redis ttl error:', error);
      return -1;
    }
  }

  async clear(): Promise<void> {
    try {
      await this.ensureConnection();
      await this.client.flushDb();
    } catch (error) {
      console.error('Redis clear error:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.isConnected) {
        await this.client.disconnect();
      }
    } catch (error) {
      console.error('Redis disconnect error:', error);
    }
  }

  // Redis-specific utility methods
  async ping(): Promise<string> {
    try {
      await this.ensureConnection();
      return await this.client.ping();
    } catch (error) {
      console.error('Redis ping error:', error);
      throw error;
    }
  }

  async info(): Promise<string> {
    try {
      await this.ensureConnection();
      return await this.client.info();
    } catch (error) {
      console.error('Redis info error:', error);
      throw error;
    }
  }
}