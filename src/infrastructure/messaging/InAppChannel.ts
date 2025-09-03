import { eq, and, desc, sql } from 'drizzle-orm';
import db from '../../db/db.js';
import { notifications, users } from '../../db/schema.js';
import {
  INotificationChannel,
  NotificationMessage,
  NotificationRecipient,
  NotificationDeliveryStatus,
  BulkNotificationResult,
  NotificationChannelConfig,
  NotificationTemplate
} from './INotificationChannel.js';

export interface InAppChannelConfig extends NotificationChannelConfig {
  maxNotificationsPerUser: number;
  autoDeleteAfterDays: number;
  realTime: {
    enabled: boolean;
    socketNamespace?: string;
  };
  badgeCount: {
    enabled: boolean;
    maxCount: number;
  };
}

export class InAppChannel implements INotificationChannel {
  readonly channelType = 'in_app' as const;
  private config: InAppChannelConfig;
  private socketIO?: any; // Socket.io instance will be injected

  constructor(config: InAppChannelConfig, socketIO?: any) {
    this.config = config;
    this.socketIO = socketIO;
  }

  async send(recipient: NotificationRecipient, message: NotificationMessage): Promise<NotificationDeliveryStatus> {
    const deliveryStatus: NotificationDeliveryStatus = {
      messageId: message.id || this.generateMessageId(),
      recipientId: recipient.id,
      status: 'pending',
      timestamp: new Date(),
    };

    try {
      if (!this.config.enabled) {
        throw new Error('In-app channel is disabled');
      }

      if (!(await this.validateRecipient(recipient))) {
        throw new Error('Invalid recipient');
      }

      // Check if recipient has in-app notifications enabled
      if (recipient.preferences?.inApp === false) {
        deliveryStatus.status = 'failed';
        deliveryStatus.error = 'Recipient has disabled in-app notifications';
        return deliveryStatus;
      }

      // Clean up old notifications if limit exceeded
      await this.cleanupOldNotifications(recipient.id);

      // Create notification in database
      const [notification] = await db()
        .insert(notifications)
        .values({
          userId: recipient.id,
          type: message.type as 'message' | 'mention' | 'reaction' | 'system',
          title: message.title,
          body: message.body || null,
          data: message.data || null,
          isRead: false,
          readAt: null,
        })
        .returning();

      if (notification) {
        deliveryStatus.status = 'sent';
        deliveryStatus.deliveredAt = new Date();
        deliveryStatus.messageId = notification.id;

        // Send real-time notification via WebSocket
        if (this.config.realTime.enabled && this.socketIO) {
          await this.sendRealTimeNotification(recipient.id, {
            ...notification,
            ...message,
            id: notification.id,
          });
        }

        // Update badge count if enabled
        if (this.config.badgeCount.enabled) {
          await this.updateBadgeCount(recipient.id);
        }
      }

      console.log(`In-app notification sent to user ${recipient.id}`, {
        notificationId: notification?.id,
        type: message.type,
        title: message.title,
      });

    } catch (error) {
      deliveryStatus.status = 'failed';
      deliveryStatus.error = error instanceof Error ? error.message : 'Unknown error';
      
      console.error(`Failed to send in-app notification to user ${recipient.id}:`, error);
    }

    return deliveryStatus;
  }

  async sendBulk(recipients: NotificationRecipient[], message: NotificationMessage): Promise<BulkNotificationResult> {
    const result: BulkNotificationResult = {
      successful: [],
      failed: [],
      totalSent: 0,
      totalFailed: 0,
    };

    // Process in batches to avoid overwhelming the database
    const batchSize = 50;
    const batches = this.chunkArray(recipients, batchSize);

    for (const batch of batches) {
      try {
        // Prepare notification data for bulk insert
        const notificationData = batch
          .filter(recipient => recipient.preferences?.inApp !== false)
          .map(recipient => ({
            userId: recipient.id,
            type: message.type as 'message' | 'mention' | 'reaction' | 'system',
            title: message.title,
            body: message.body || null,
            data: message.data || null,
            isRead: false,
            readAt: null,
          }));

        if (notificationData.length === 0) {
          // All recipients have disabled in-app notifications
          batch.forEach(recipient => {
            result.failed.push({
              recipientId: recipient.id,
              error: 'In-app notifications disabled',
            });
            result.totalFailed++;
          });
          continue;
        }

        // Bulk insert notifications
        const insertedNotifications = await db()
          .insert(notifications)
          .values(notificationData)
          .returning();

        // Send real-time notifications
        if (this.config.realTime.enabled && this.socketIO) {
          const realTimePromises = insertedNotifications.map((notification, index) => {
            const recipient = batch.find(r => r.id === notification.userId);
            if (recipient) {
              return this.sendRealTimeNotification(recipient.id, {
                ...notification,
                ...message,
                id: notification.id,
              });
            }
            return Promise.resolve();
          });

          await Promise.allSettled(realTimePromises);
        }

        // Update badge counts
        if (this.config.badgeCount.enabled) {
          const badgeUpdatePromises = batch.map(recipient => 
            this.updateBadgeCount(recipient.id)
          );
          await Promise.allSettled(badgeUpdatePromises);
        }

        // Mark successful deliveries
        batch.forEach(recipient => {
          result.successful.push(recipient.id);
          result.totalSent++;
        });

      } catch (error) {
        // Mark all recipients in this batch as failed
        batch.forEach(recipient => {
          result.failed.push({
            recipientId: recipient.id,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          result.totalFailed++;
        });
      }
    }

    return result;
  }

  async sendTemplate(
    recipient: NotificationRecipient,
    templateId: string,
    variables: Record<string, any>
  ): Promise<NotificationDeliveryStatus> {
    const template = this.config.templates?.[templateId];
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    const compiledMessage = this.compileTemplate(template, variables);
    return this.send(recipient, compiledMessage);
  }

  async schedule(
    recipient: NotificationRecipient,
    message: NotificationMessage,
    scheduleTime: Date
  ): Promise<string> {
    // This would integrate with a job queue like Bull or Agenda
    // For now, we'll simulate scheduling with setTimeout (not recommended for production)
    const jobId = this.generateJobId();
    const delay = scheduleTime.getTime() - Date.now();

    if (delay <= 0) {
      throw new Error('Schedule time must be in the future');
    }

    setTimeout(async () => {
      try {
        await this.send(recipient, message);
        console.log(`Scheduled in-app notification sent to user ${recipient.id} at ${scheduleTime}`);
      } catch (error) {
        console.error(`Failed to send scheduled in-app notification:`, error);
      }
    }, delay);

    console.log(`In-app notification scheduled for user ${recipient.id} at ${scheduleTime} with job ID: ${jobId}`);
    return jobId;
  }

  async cancelScheduled(jobId: string): Promise<boolean> {
    // This would integrate with a job queue to cancel scheduled jobs
    console.log(`Cancel scheduled in-app notification job: ${jobId} (not implemented for setTimeout)`);
    return false;
  }

  async getDeliveryStatus(messageId: string): Promise<NotificationDeliveryStatus[]> {
    try {
      const notification = await db()
        .select()
        .from(notifications)
        .where(eq(notifications.id, messageId))
        .limit(1);

      if (notification.length === 0) {
        return [];
      }

      const status: NotificationDeliveryStatus = {
        messageId: notification[0]?.id || '',
        recipientId: notification[0]?.userId || '',
        status: notification[0]?.isRead ? 'read' : 'delivered',
        timestamp: notification[0]?.createdAt || new Date(),
        deliveredAt: notification[0]?.createdAt || new Date(),
        readAt: notification[0]?.readAt || undefined,
      };

      return [status];
    } catch (error) {
      console.error('Failed to get delivery status:', error);
      return [];
    }
  }

  async validateRecipient(recipient: NotificationRecipient): Promise<boolean> {
    try {
      // Check if user exists in database
      const user = await db()
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, recipient.id))
        .limit(1);

      return user.length > 0;
    } catch (error) {
      console.error('Failed to validate recipient:', error);
      return false;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      // Test database connection by querying notifications table
      await db().select().from(notifications).limit(1);
      return true;
    } catch (error) {
      console.error('In-app channel health check failed:', error);
      return false;
    }
  }

  getConfig(): Record<string, any> {
    return { ...this.config };
  }

  async updateConfig(config: Record<string, any>): Promise<void> {
    this.config = { ...this.config, ...config } as InAppChannelConfig;
  }

  // In-app specific methods

  async markAsRead(userId: string, notificationId: string): Promise<boolean> {
    try {
      const result = await db()
        .update(notifications)
        .set({
          isRead: true,
          readAt: new Date(),
        })
        .where(
          and(
            eq(notifications.id, notificationId),
            eq(notifications.userId, userId)
          )
        )
        .returning();

      if (result.length > 0 && this.config.badgeCount.enabled) {
        await this.updateBadgeCount(userId);
      }

      return result.length > 0;
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
      return false;
    }
  }

  async markAllAsRead(userId: string): Promise<number> {
    try {
      const result = await db()
        .update(notifications)
        .set({
          isRead: true,
          readAt: new Date(),
        })
        .where(
          and(
            eq(notifications.userId, userId),
            eq(notifications.isRead, false)
          )
        )
        .returning();

      if (result.length > 0 && this.config.badgeCount.enabled) {
        await this.updateBadgeCount(userId);
      }

      return result.length;
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
      return 0;
    }
  }

  async getUserNotifications(
    userId: string,
    options: {
      limit?: number;
      offset?: number;
      unreadOnly?: boolean;
      type?: NotificationMessage['type'];
    } = {}
  ): Promise<any[]> {
    try {
      const { limit = 50, offset = 0, unreadOnly = false, type } = options;

      let query = db()
        .select()
        .from(notifications)
        .where(eq(notifications.userId, userId))
        .$dynamic();

      if (unreadOnly) {
        query = query.where(eq(notifications.isRead, false));
      }

      if (type && (type === 'message' || type === 'mention' || type === 'reaction' || type === 'system')) {
        query = query.where(eq(notifications.type, type));
      }

      const result = await query
        .orderBy(desc(notifications.createdAt))
        .limit(limit)
        .offset(offset);

      return result.map(notification => ({
        ...notification,
        data: notification.data || null,
      }));
    } catch (error) {
      console.error('Failed to get user notifications:', error);
      return [];
    }
  }

  async getUnreadCount(userId: string): Promise<number> {
    try {
      const result = await db()
        .select({ count: sql<number>`count(*)` })
        .from(notifications)
        .where(
          and(
            eq(notifications.userId, userId),
            eq(notifications.isRead, false)
          )
        );

      return result[0]?.count || 0;
    } catch (error) {
      console.error('Failed to get unread count:', error);
      return 0;
    }
  }

  private async cleanupOldNotifications(userId: string): Promise<void> {
    try {
      // Count current notifications for user
      const countResult = await db()
        .select({ count: sql<number>`count(*)` })
        .from(notifications)
        .where(eq(notifications.userId, userId));

      const currentCount = countResult[0]?.count || 0;

      if (currentCount >= this.config.maxNotificationsPerUser) {
        // Delete oldest notifications to make room
        const deleteCount = currentCount - this.config.maxNotificationsPerUser + 1;
        
        const oldestNotifications = await db()
          .select({ id: notifications.id })
          .from(notifications)
          .where(eq(notifications.userId, userId))
          .orderBy(notifications.createdAt)
          .limit(deleteCount);

        if (oldestNotifications.length > 0) {
          const idsToDelete = oldestNotifications.map(n => n.id);
          await db()
            .delete(notifications)
            .where(sql`${notifications.id} = ANY(${idsToDelete})`);
        }
      }

      // Delete notifications older than configured days
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.config.autoDeleteAfterDays);

      await db()
        .delete(notifications)
        .where(
          and(
            eq(notifications.userId, userId),
            sql`${notifications.createdAt} < ${cutoffDate}`
          )
        );

    } catch (error) {
      console.error('Failed to cleanup old notifications:', error);
    }
  }

  private async sendRealTimeNotification(userId: string, notification: any): Promise<void> {
    try {
      if (!this.socketIO) return;

      const namespace = this.config.realTime.socketNamespace || '/';
      const io = this.socketIO.of(namespace);

      // Send to specific user room
      io.to(`user-${userId}`).emit('notification', {
        id: notification.id,
        type: notification.type,
        title: notification.title,
        body: notification.body,
        data: notification.data,
        timestamp: notification.createdAt,
        category: notification.category,
        priority: notification.priority,
      });

    } catch (error) {
      console.error('Failed to send real-time notification:', error);
    }
  }

  private async updateBadgeCount(userId: string): Promise<void> {
    try {
      const unreadCount = await this.getUnreadCount(userId);
      const badgeCount = Math.min(unreadCount, this.config.badgeCount.maxCount);

      if (this.socketIO) {
        const namespace = this.config.realTime.socketNamespace || '/';
        const io = this.socketIO.of(namespace);
        
        io.to(`user-${userId}`).emit('badge-update', {
          count: badgeCount,
          hasMore: unreadCount > this.config.badgeCount.maxCount,
        });
      }

    } catch (error) {
      console.error('Failed to update badge count:', error);
    }
  }

  private compileTemplate(template: NotificationTemplate, variables: Record<string, any>): NotificationMessage {
    let compiledTitle = template.title || '';
    let compiledBody = template.body;

    // Simple template variable replacement
    Object.entries(variables).forEach(([key, value]) => {
      const placeholder = `{{${key}}}`;
      compiledTitle = compiledTitle.replace(new RegExp(placeholder, 'g'), String(value));
      compiledBody = compiledBody.replace(new RegExp(placeholder, 'g'), String(value));
    });

    return {
      title: compiledTitle,
      body: compiledBody,
      type: template.type,
      priority: template.priority,
      category: template.category,
      data: variables,
    };
  }

  private generateMessageId(): string {
    return `in-app-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateJobId(): string {
    return `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  setSocketIO(socketIO: any): void {
    this.socketIO = socketIO;
  }
}