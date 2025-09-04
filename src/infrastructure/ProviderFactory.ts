import { IAuthProvider } from './auth/providers/IAuthProvider.js';
import { LocalAuthProvider } from './auth/providers/LocalAuthProvider.js';
import { AzureAuthProvider } from './auth/providers/AzureAuthProvider.js';

import { IStorageProvider, StorageConfig } from './storage/IStorageProvider.js';
import { LocalStorageProvider } from './storage/LocalStorageProvider.js';
import { AzureBlobProvider } from './storage/AzureBlobProvider.js';
import { MinioStorageProvider } from './storage/MinioStorageProvider.js';

import { ICacheProvider, CacheConfig } from './cache/ICacheProvider.js';
import { RedisProvider } from './cache/RedisProvider.js';

import { INotificationChannel, NotificationChannelConfig } from './messaging/INotificationChannel.js';
import { EmailChannel, EmailChannelConfig } from './messaging/EmailChannel.js';
import { InAppChannel, InAppChannelConfig } from './messaging/InAppChannel.js';

export interface ProviderConfiguration {
  auth: {
    provider: 'local' | 'azure';
    config: any;
  };
  storage: {
    provider: 'local' | 'azure' | 's3' | 'gcs' | 'minio';
    config: StorageConfig;
  };
  cache: {
    provider: 'redis' | 'memory' | 'azure_redis';
    config: CacheConfig;
  };
  notifications: {
    email?: {
      enabled: boolean;
      config: EmailChannelConfig;
    };
    inApp?: {
      enabled: boolean;
      config: InAppChannelConfig;
    };
    push?: {
      enabled: boolean;
      config: NotificationChannelConfig;
    };
    sms?: {
      enabled: boolean;
      config: NotificationChannelConfig;
    };
  };
}

export class ProviderFactory {
  private static instance: ProviderFactory;
  private configuration: ProviderConfiguration;
  private authProvider?: IAuthProvider;
  private storageProvider?: IStorageProvider;
  private cacheProvider?: ICacheProvider;
  private notificationChannels: Map<string, INotificationChannel> = new Map();

  constructor(configuration: ProviderConfiguration) {
    this.configuration = configuration;
  }

  static getInstance(configuration?: ProviderConfiguration): ProviderFactory {
    if (!ProviderFactory.instance) {
      if (!configuration) {
        throw new Error('Configuration is required for first initialization');
      }
      ProviderFactory.instance = new ProviderFactory(configuration);
    }
    return ProviderFactory.instance;
  }

  static createFromEnvironment(): ProviderFactory {
    const configuration: ProviderConfiguration = {
      auth: {
        provider: (process.env.AUTH_PROVIDER as 'local' | 'azure') || 'local',
        config: {
          jwtSecret: process.env.JWT_SECRET || 'your-super-secret-jwt-key',
          jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'your-super-secret-refresh-key',
          accessTokenExpiry: process.env.ACCESS_TOKEN_EXPIRY || '15m',
          refreshTokenExpiry: process.env.REFRESH_TOKEN_EXPIRY || '7d',
          // Azure AD specific config
          ...(process.env.AUTH_PROVIDER === 'azure' && {
            tenantId: process.env.AZURE_TENANT_ID,
            clientId: process.env.AZURE_CLIENT_ID,
            clientSecret: process.env.AZURE_CLIENT_SECRET,
          }),
        },
      },
      storage: {
        provider: (process.env.STORAGE_PROVIDER as any) || 'local',
        config: {
          provider: (process.env.STORAGE_PROVIDER as any) || 'local',
          ...(process.env.STORAGE_PROVIDER === 'local' && {
            baseUrl: process.env.STORAGE_BASE_URL || 'http://localhost:3000',
          }),
          ...(process.env.STORAGE_PROVIDER === 'azure' && {
            connectionString: process.env.AZURE_STORAGE_CONNECTION_STRING,
            containerName: process.env.AZURE_STORAGE_CONTAINER || 'uploads',
          }),
        },
      },
      cache: {
        provider: (process.env.CACHE_PROVIDER as any) || 'redis',
        config: {
          provider: (process.env.CACHE_PROVIDER as any) || 'redis',
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379'),
          password: process.env.REDIS_PASSWORD,
          database: parseInt(process.env.REDIS_DB || '0'),
          keyPrefix: process.env.REDIS_KEY_PREFIX || 'sports-app:',
          defaultTTL: parseInt(process.env.REDIS_DEFAULT_TTL || '3600'),
        },
      },
      notifications: {
        email: {
          enabled: process.env.EMAIL_ENABLED === 'true',
          config: {
            enabled: process.env.EMAIL_ENABLED === 'true',
            smtp: {
              host: process.env.SMTP_HOST || 'localhost',
              port: parseInt(process.env.SMTP_PORT || '587'),
              secure: process.env.SMTP_SECURE === 'true',
              auth: process.env.SMTP_USER ? {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS || '',
              } : undefined,
            },
            from: {
              name: process.env.EMAIL_FROM_NAME || 'Sports App',
              address: process.env.EMAIL_FROM_ADDRESS || 'noreply@sportsapp.com',
            },
            rateLimit: {
              maxPerMinute: parseInt(process.env.EMAIL_RATE_LIMIT_PER_MINUTE || '50'),
              maxPerHour: parseInt(process.env.EMAIL_RATE_LIMIT_PER_HOUR || '1000'),
              maxPerDay: parseInt(process.env.EMAIL_RATE_LIMIT_PER_DAY || '10000'),
            },
          } as EmailChannelConfig,
        },
        inApp: {
          enabled: true, // Always enabled for in-app notifications
          config: {
            enabled: true,
            maxNotificationsPerUser: parseInt(process.env.IN_APP_MAX_NOTIFICATIONS_PER_USER || '100'),
            autoDeleteAfterDays: parseInt(process.env.IN_APP_AUTO_DELETE_AFTER_DAYS || '30'),
            realTime: {
              enabled: process.env.REALTIME_NOTIFICATIONS === 'true',
              socketNamespace: process.env.SOCKET_NAMESPACE || '/',
            },
            badgeCount: {
              enabled: true,
              maxCount: parseInt(process.env.BADGE_MAX_COUNT || '99'),
            },
          } as InAppChannelConfig,
        },
      },
    };

    return ProviderFactory.getInstance(configuration);
  }

  // Authentication Provider
  getAuthProvider(): IAuthProvider {
    if (!this.authProvider) {
      switch (this.configuration.auth.provider) {
        case 'azure':
          this.authProvider = new AzureAuthProvider();
          break;
        case 'local':
        default:
          this.authProvider = new LocalAuthProvider();
          break;
      }
    }
    return this.authProvider;
  }

  // Storage Provider
  getStorageProvider(): IStorageProvider {
    if (!this.storageProvider) {
      switch (this.configuration.storage.provider) {
        case 'azure':
          this.storageProvider = new AzureBlobProvider(
            this.configuration.storage.config.connectionString || '',
            this.configuration.storage.config.containerName || 'uploads'
          );
          break;
        case 'minio':
          this.storageProvider = new MinioStorageProvider({
            endPoint: process.env.MINIO_ENDPOINT || 'localhost',
            port: parseInt(process.env.MINIO_PORT || '9000'),
            useSSL: process.env.MINIO_USE_SSL === 'true',
            accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
            secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin123',
            bucketName: process.env.MINIO_BUCKET || 'sports-app',
            baseUrl: process.env.MINIO_BASE_URL || 'http://localhost:9000'
          });
          break;
        case 'local':
        default:
          this.storageProvider = new LocalStorageProvider();
          break;
        // Additional providers can be added here (S3, GCS, etc.)
      }
    }
    return this.storageProvider;
  }

  // Cache Provider
  getCacheProvider(): ICacheProvider {
    if (!this.cacheProvider) {
      switch (this.configuration.cache.provider) {
        case 'redis':
        case 'azure_redis':
        default:
          this.cacheProvider = new RedisProvider(this.configuration.cache.config);
          break;
        // Additional providers can be added here (Memory cache, etc.)
      }
    }
    return this.cacheProvider;
  }

  // Notification Channels
  getNotificationChannel(type: 'email' | 'inApp' | 'push' | 'sms'): INotificationChannel | null {
    if (this.notificationChannels.has(type)) {
      return this.notificationChannels.get(type)!;
    }

    let channel: INotificationChannel | null = null;

    switch (type) {
      case 'email':
        if (this.configuration.notifications.email?.enabled) {
          channel = new EmailChannel(this.configuration.notifications.email.config);
        }
        break;
      case 'inApp':
        if (this.configuration.notifications.inApp?.enabled) {
          channel = new InAppChannel(this.configuration.notifications.inApp.config, undefined);
        }
        break;
      // Additional channels can be added here (push, sms, etc.)
    }

    if (channel) {
      this.notificationChannels.set(type, channel);
    }

    return channel;
  }

  getEnabledNotificationChannels(): INotificationChannel[] {
    const channels: INotificationChannel[] = [];
    
    const channelTypes: Array<'email' | 'inApp' | 'push' | 'sms'> = ['email', 'inApp', 'push', 'sms'];
    
    for (const type of channelTypes) {
      const channel = this.getNotificationChannel(type);
      if (channel) {
        channels.push(channel);
      }
    }
    
    return channels;
  }

  // Configuration management
  updateConfiguration(newConfiguration: Partial<ProviderConfiguration>): void {
    this.configuration = { ...this.configuration, ...newConfiguration };
    
    // Reset cached providers to force re-initialization with new config
    this.authProvider = undefined;
    this.storageProvider = undefined;
    this.cacheProvider = undefined;
    this.notificationChannels.clear();
  }

  getConfiguration(): ProviderConfiguration {
    return { ...this.configuration };
  }

  // Health checks
  async healthCheck(): Promise<{
    auth: boolean;
    storage: boolean;
    cache: boolean;
    notifications: Record<string, boolean>;
  }> {
    const results = {
      auth: false,
      storage: false,
      cache: false,
      notifications: {} as Record<string, boolean>,
    };

    try {
      // Auth provider health check (if applicable)
      results.auth = true; // Auth providers typically don't have health checks
    } catch (error) {
      console.error('Auth provider health check failed:', error);
    }

    try {
      // Storage provider health check
      const storageProvider = this.getStorageProvider();
      if ('healthCheck' in storageProvider && typeof storageProvider.healthCheck === 'function') {
        results.storage = await storageProvider.healthCheck();
      } else {
        results.storage = true; // Assume healthy if no health check method
      }
    } catch (error) {
      console.error('Storage provider health check failed:', error);
    }

    try {
      // Cache provider health check
      const cacheProvider = this.getCacheProvider();
      if ('ping' in cacheProvider && typeof cacheProvider.ping === 'function') {
        await (cacheProvider as any).ping();
        results.cache = true;
      } else {
        results.cache = true; // Assume healthy if no ping method
      }
    } catch (error) {
      console.error('Cache provider health check failed:', error);
    }

    // Notification channels health checks
    const channelTypes: Array<'email' | 'inApp' | 'push' | 'sms'> = ['email', 'inApp', 'push', 'sms'];
    
    for (const type of channelTypes) {
      try {
        const channel = this.getNotificationChannel(type);
        if (channel) {
          results.notifications[type] = await channel.healthCheck();
        }
      } catch (error) {
        console.error(`${type} notification channel health check failed:`, error);
        results.notifications[type] = false;
      }
    }

    return results;
  }

  // Cleanup method
  async cleanup(): Promise<void> {
    try {
      // Disconnect cache provider
      if (this.cacheProvider) {
        await this.cacheProvider.disconnect();
      }

      // Clear notification channels
      this.notificationChannels.clear();

      console.log('Provider factory cleanup completed');
    } catch (error) {
      console.error('Provider factory cleanup failed:', error);
    }
  }
}

// Export singleton instance creator
export const createProviderFactory = (configuration?: ProviderConfiguration): ProviderFactory => {
  if (configuration) {
    return ProviderFactory.getInstance(configuration);
  }
  return ProviderFactory.createFromEnvironment();
};