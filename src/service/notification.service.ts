import { eq, and, desc, sql } from "drizzle-orm";
import db from "../db/db.js";
import { notifications, users } from "../db/schema.js";

export interface NotificationData {
  userId: string;
  type: "message" | "mention" | "reaction" | "system";
  title: string;
  body?: string;
  data?: any;
}

export interface BulkNotificationData {
  userIds: string[];
  type: "message" | "mention" | "reaction" | "system";
  title: string;
  body?: string;
  data?: any;
}

export class NotificationService {
  async createNotification(data: NotificationData): Promise<any> {
    const [notification] = await db().insert(notifications).values(data).returning();

    await this.sendToChannels(notification);

    return notification;
  }

  async createBulkNotifications(data: BulkNotificationData): Promise<any[]> {
    const notificationsData = data.userIds.map((userId) => ({
      userId,
      type: data.type,
      title: data.title,
      body: data.body,
      data: data.data,
    }));

    const createdNotifications = await db().insert(notifications).values(notificationsData).returning();

    for (const notification of createdNotifications) {
      await this.sendToChannels(notification);
    }

    return createdNotifications;
  }

  async getUserNotifications(userId: string, unreadOnly: boolean = false, limit: number = 50): Promise<any[]> {
    let query = db()
      .select({
        notification: notifications,
        data: sql`${notifications.data}`,
      })
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .$dynamic();

    if (unreadOnly) {
      query = query.where(eq(notifications.isRead, false));
    }

    const results = await query.orderBy(desc(notifications.createdAt)).limit(limit);

    return results;
  }

  async markAsRead(notificationId: string, userId: string): Promise<any> {
    const [updated] = await db()
      .update(notifications)
      .set({
        isRead: true,
        readAt: new Date(),
      })
      .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)))
      .returning();

    return updated;
  }

  async markAllAsRead(userId: string): Promise<number> {
    const result = await db()
      .update(notifications)
      .set({
        isRead: true,
        readAt: new Date(),
      })
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)))
      .returning({ id: notifications.id });

    return result.length;
  }

  async getUnreadCount(userId: string): Promise<number> {
    const result = await db()
      .select({
        count: sql<number>`COUNT(*)`,
      })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));

    return result[0]?.count || 0;
  }

  async deleteNotification(notificationId: string, userId: string): Promise<void> {
    await db()
      .delete(notifications)
      .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)));
  }

  async deleteOldNotifications(daysToKeep: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const deleted = await db()
      .delete(notifications)
      .where(and(sql`${notifications.createdAt} < ${cutoffDate}`, eq(notifications.isRead, true)))
      .returning({ id: notifications.id });

    return deleted.length;
  }

  async getUserNotificationSettings(userId: string): Promise<any> {
    const [user] = await db()
      .select({
        notificationSettings: users.notificationSettings,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    return (
      user?.notificationSettings || {
        email: true,
        push: true,
        sound: true,
        desktop: true,
      }
    );
  }

  async updateNotificationSettings(userId: string, settings: any): Promise<void> {
    await db()
      .update(users)
      .set({
        notificationSettings: settings,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  }

  async notifyMentions(
    conversationId: string,
    messageId: string,
    senderId: string,
    content: string,
    mentionedUserIds: string[]
  ): Promise<void> {
    if (mentionedUserIds.length === 0) return;

    const [sender] = await db()
      .select({
        username: users.username,
        fullName: users.fullName,
      })
      .from(users)
      .where(eq(users.id, senderId))
      .limit(1);

    const senderName = sender?.fullName || sender?.username || "Someone";

    await this.createBulkNotifications({
      userIds: mentionedUserIds,
      type: "mention",
      title: `${senderName} mentioned you`,
      body: content.substring(0, 100),
      data: {
        conversationId,
        messageId,
        senderId,
      },
    });
  }

  async notifyReaction(messageId: string, messageSenderId: string, reactorId: string, emoji: string): Promise<void> {
    if (messageSenderId === reactorId) return;

    const [reactor] = await db()
      .select({
        username: users.username,
        fullName: users.fullName,
      })
      .from(users)
      .where(eq(users.id, reactorId))
      .limit(1);

    const reactorName = reactor?.fullName || reactor?.username || "Someone";

    await this.createNotification({
      userId: messageSenderId,
      type: "reaction",
      title: `${reactorName} reacted to your message`,
      body: emoji,
      data: {
        messageId,
        reactorId,
        emoji,
      },
    });
  }

  private async sendToChannels(notification: any): Promise<void> {
    const settings = await this.getUserNotificationSettings(notification.userId);

    if (settings.desktop) {
      this.sendDesktopNotification(notification);
    }

    if (settings.push) {
      this.sendPushNotification(notification);
    }

    if (settings.email && this.shouldSendEmail(notification.type)) {
      this.sendEmailNotification(notification);
    }
  }

  private sendDesktopNotification(notification: any): void {
    console.log("Desktop notification:", notification);
  }

  private sendPushNotification(notification: any): void {
    console.log("Push notification:", notification);
  }

  private sendEmailNotification(notification: any): void {
    console.log("Email notification:", notification);
  }

  private shouldSendEmail(type: string): boolean {
    const emailTypes = ["system", "mention"];
    return emailTypes.includes(type);
  }
}

export const notificationService = new NotificationService();
