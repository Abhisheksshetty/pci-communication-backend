import { ICacheProvider } from '../infrastructure/cache/ICacheProvider.js';
import { createProviderFactory } from '../infrastructure/ProviderFactory.js';

export interface CacheOptions {
  ttl?: number;
  tags?: string[];
  compress?: boolean;
}

export class CacheService {
  private cache: ICacheProvider;
  private readonly defaultTTL = 3600; // 1 hour
  
  // Cache key prefixes
  private readonly prefixes = {
    user: 'user:',
    conversation: 'conv:',
    message: 'msg:',
    session: 'session:',
    presence: 'presence:',
    notification: 'notif:',
    document: 'doc:',
    image: 'img:',
    search: 'search:',
    stats: 'stats:'
  };

  constructor(cache?: ICacheProvider) {
    this.cache = cache || createProviderFactory().getCacheProvider();
  }

  // User-related caching
  async getUserCache(userId: string): Promise<any> {
    return await this.cache.get(`${this.prefixes.user}${userId}`);
  }

  async setUserCache(userId: string, userData: any, ttl?: number): Promise<void> {
    await this.cache.set(
      `${this.prefixes.user}${userId}`,
      userData,
      ttl || this.defaultTTL
    );
  }

  async invalidateUserCache(userId: string): Promise<void> {
    await this.cache.delete(`${this.prefixes.user}${userId}`);
    // Also invalidate related caches
    await this.cache.invalidate(`${this.prefixes.session}${userId}:*`);
    await this.cache.invalidate(`${this.prefixes.presence}${userId}`);
  }

  // Conversation caching
  async getConversationCache(conversationId: string): Promise<any> {
    return await this.cache.get(`${this.prefixes.conversation}${conversationId}`);
  }

  async setConversationCache(
    conversationId: string,
    conversationData: any,
    ttl?: number
  ): Promise<void> {
    await this.cache.set(
      `${this.prefixes.conversation}${conversationId}`,
      conversationData,
      ttl || this.defaultTTL
    );
  }

  async getConversationMessages(
    conversationId: string,
    page: number = 1
  ): Promise<any> {
    return await this.cache.get(
      `${this.prefixes.message}list:${conversationId}:${page}`
    );
  }

  async setConversationMessages(
    conversationId: string,
    messages: any[],
    page: number = 1,
    ttl?: number
  ): Promise<void> {
    await this.cache.set(
      `${this.prefixes.message}list:${conversationId}:${page}`,
      messages,
      ttl || 300 // 5 minutes for message lists
    );
  }

  async invalidateConversationCache(conversationId: string): Promise<void> {
    await this.cache.delete(`${this.prefixes.conversation}${conversationId}`);
    await this.cache.invalidate(`${this.prefixes.message}list:${conversationId}:*`);
  }

  // Session management
  async getSession(sessionId: string): Promise<any> {
    return await this.cache.get(`${this.prefixes.session}${sessionId}`);
  }

  async setSession(sessionId: string, sessionData: any, ttl?: number): Promise<void> {
    await this.cache.set(
      `${this.prefixes.session}${sessionId}`,
      sessionData,
      ttl || 86400 // 24 hours
    );
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.cache.delete(`${this.prefixes.session}${sessionId}`);
  }

  async getUserSessions(userId: string): Promise<string[]> {
    const sessions = await this.cache.get<string[]>(`${this.prefixes.session}${userId}:list`);
    return sessions || [];
  }

  async addUserSession(userId: string, sessionId: string): Promise<void> {
    const sessions = await this.getUserSessions(userId);
    if (!sessions.includes(sessionId)) {
      sessions.push(sessionId);
      await this.cache.set(
        `${this.prefixes.session}${userId}:list`,
        sessions,
        86400
      );
    }
  }

  // Presence caching
  async getUserPresence(userId: string): Promise<any> {
    return await this.cache.get(`${this.prefixes.presence}${userId}`);
  }

  async setUserPresence(
    userId: string,
    presence: {
      status: 'online' | 'offline' | 'away' | 'busy';
      lastSeen: Date;
      device?: string;
    }
  ): Promise<void> {
    await this.cache.set(
      `${this.prefixes.presence}${userId}`,
      presence,
      300 // 5 minutes
    );
  }

  async getTypingIndicator(conversationId: string): Promise<string[]> {
    const typing = await this.cache.get<string[]>(`typing:${conversationId}`);
    return typing || [];
  }

  async setTypingIndicator(
    conversationId: string,
    userId: string,
    isTyping: boolean
  ): Promise<void> {
    const typing = await this.getTypingIndicator(conversationId);
    
    if (isTyping && !typing.includes(userId)) {
      typing.push(userId);
    } else if (!isTyping) {
      const index = typing.indexOf(userId);
      if (index > -1) {
        typing.splice(index, 1);
      }
    }

    await this.cache.set(
      `typing:${conversationId}`,
      typing,
      10 // 10 seconds for typing indicators
    );
  }

  // Notification caching
  async getUnreadCount(userId: string): Promise<number> {
    const count = await this.cache.get<number>(`${this.prefixes.notification}unread:${userId}`);
    return count || 0;
  }

  async setUnreadCount(userId: string, count: number): Promise<void> {
    await this.cache.set(
      `${this.prefixes.notification}unread:${userId}`,
      count,
      3600
    );
  }

  async incrementUnreadCount(userId: string): Promise<number> {
    const current = await this.getUnreadCount(userId);
    const newCount = current + 1;
    await this.setUnreadCount(userId, newCount);
    return newCount;
  }

  // Document caching
  async getDocumentMetadata(documentId: string): Promise<any> {
    return await this.cache.get(`${this.prefixes.document}meta:${documentId}`);
  }

  async setDocumentMetadata(documentId: string, metadata: any, ttl?: number): Promise<void> {
    await this.cache.set(
      `${this.prefixes.document}meta:${documentId}`,
      metadata,
      ttl || 7200 // 2 hours
    );
  }

  async getDocumentUrl(documentId: string): Promise<string | null> {
    return await this.cache.get(`${this.prefixes.document}url:${documentId}`);
  }

  async setDocumentUrl(documentId: string, url: string, ttl?: number): Promise<void> {
    await this.cache.set(
      `${this.prefixes.document}url:${documentId}`,
      url,
      ttl || 3600 // 1 hour
    );
  }

  // Image caching
  async getImageUrl(imageId: string, variant: string = 'original'): Promise<string | null> {
    return await this.cache.get(`${this.prefixes.image}${imageId}:${variant}`);
  }

  async setImageUrl(
    imageId: string,
    variant: string,
    url: string,
    ttl?: number
  ): Promise<void> {
    await this.cache.set(
      `${this.prefixes.image}${imageId}:${variant}`,
      url,
      ttl || 86400 // 24 hours
    );
  }

  async getImageMetadata(imageId: string): Promise<any> {
    return await this.cache.get(`${this.prefixes.image}meta:${imageId}`);
  }

  async setImageMetadata(imageId: string, metadata: any, ttl?: number): Promise<void> {
    await this.cache.set(
      `${this.prefixes.image}meta:${imageId}`,
      metadata,
      ttl || 86400
    );
  }

  // Search results caching
  async getSearchResults(query: string, type: string): Promise<any> {
    const key = `${this.prefixes.search}${type}:${this.hashQuery(query)}`;
    return await this.cache.get(key);
  }

  async setSearchResults(
    query: string,
    type: string,
    results: any,
    ttl?: number
  ): Promise<void> {
    const key = `${this.prefixes.search}${type}:${this.hashQuery(query)}`;
    await this.cache.set(key, results, ttl || 600); // 10 minutes
  }

  // Statistics caching
  async getUserStats(userId: string): Promise<any> {
    return await this.cache.get(`${this.prefixes.stats}user:${userId}`);
  }

  async setUserStats(userId: string, stats: any, ttl?: number): Promise<void> {
    await this.cache.set(
      `${this.prefixes.stats}user:${userId}`,
      stats,
      ttl || 1800 // 30 minutes
    );
  }

  async getSystemStats(): Promise<any> {
    return await this.cache.get(`${this.prefixes.stats}system`);
  }

  async setSystemStats(stats: any, ttl?: number): Promise<void> {
    await this.cache.set(
      `${this.prefixes.stats}system`,
      stats,
      ttl || 300 // 5 minutes
    );
  }

  // Batch operations
  async warmupUserCache(userId: string, userData: any): Promise<void> {
    // Warm up multiple cache entries for a user
    await Promise.all([
      this.setUserCache(userId, userData),
      this.setUserPresence(userId, {
        status: 'online',
        lastSeen: new Date()
      }),
      this.setUnreadCount(userId, 0)
    ]);
  }

  async invalidateAllUserCaches(userId: string): Promise<void> {
    // Invalidate all cache entries for a user
    await Promise.all([
      this.cache.invalidate(`${this.prefixes.user}${userId}*`),
      this.cache.invalidate(`${this.prefixes.session}${userId}:*`),
      this.cache.invalidate(`${this.prefixes.presence}${userId}`),
      this.cache.invalidate(`${this.prefixes.notification}*:${userId}`),
      this.cache.invalidate(`${this.prefixes.stats}user:${userId}`)
    ]);
  }

  // Utility methods
  private hashQuery(query: string): string {
    // Simple hash function for query strings
    let hash = 0;
    for (let i = 0; i < query.length; i++) {
      const char = query.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }

  async clearCache(pattern?: string): Promise<void> {
    if (pattern) {
      await this.cache.invalidate(pattern);
    } else {
      // Clear all cache entries
      for (const prefix of Object.values(this.prefixes)) {
        await this.cache.invalidate(`${prefix}*`);
      }
    }
  }

  async getCacheStats(): Promise<{
    hits: number;
    misses: number;
    hitRate: number;
  }> {
    // This would typically connect to Redis INFO stats
    // For now, return mock data
    return {
      hits: 0,
      misses: 0,
      hitRate: 0
    };
  }
}