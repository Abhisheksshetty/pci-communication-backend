import { Server as SocketIOServer, Socket } from 'socket.io';
import { eq, and, desc } from 'drizzle-orm';
import db from '../../db/db.js';
import { notifications, users } from '../../db/schema.js';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  user?: {
    id: string;
    username: string;
    role: string;
  };
}

export const notificationHandler = {
  setupNotificationHandlers(socket: AuthenticatedSocket, io: SocketIOServer) {
    // Mark notifications as read
    socket.on('mark_notification_read', async (data: { notificationId: string }) => {
      try {
        const { notificationId } = data;
        
        if (!socket.userId) {
          socket.emit('error', { message: 'Not authenticated' });
          return;
        }

        await db()
          .update(notifications)
          .set({
            isRead: true,
            readAt: new Date()
          })
          .where(
            and(
              eq(notifications.id, notificationId),
              eq(notifications.userId, socket.userId)
            )
          );

        socket.emit('notification_marked_read', { notificationId });
        
        // Broadcast unread count update
        const unreadCount = await this.getUnreadNotificationCount(socket.userId);
        socket.emit('unread_count_updated', { count: unreadCount });

      } catch (error) {
        console.error('Mark notification read error:', error);
        socket.emit('error', { message: 'Failed to mark notification as read' });
      }
    });

    // Mark all notifications as read
    socket.on('mark_all_notifications_read', async () => {
      try {
        if (!socket.userId) {
          socket.emit('error', { message: 'Not authenticated' });
          return;
        }

        await db()
          .update(notifications)
          .set({
            isRead: true,
            readAt: new Date()
          })
          .where(
            and(
              eq(notifications.userId, socket.userId),
              eq(notifications.isRead, false)
            )
          );

        socket.emit('all_notifications_marked_read');
        socket.emit('unread_count_updated', { count: 0 });

      } catch (error) {
        console.error('Mark all notifications read error:', error);
        socket.emit('error', { message: 'Failed to mark all notifications as read' });
      }
    });

    // Get recent notifications
    socket.on('get_notifications', async (data: { limit?: number; offset?: number }) => {
      try {
        if (!socket.userId) {
          socket.emit('error', { message: 'Not authenticated' });
          return;
        }

        const { limit = 20, offset = 0 } = data;

        const userNotifications = await db()
          .select({
            id: notifications.id,
            type: notifications.type,
            title: notifications.title,
            body: notifications.body,
            data: notifications.data,
            isRead: notifications.isRead,
            readAt: notifications.readAt,
            createdAt: notifications.createdAt
          })
          .from(notifications)
          .where(eq(notifications.userId, socket.userId))
          .orderBy(desc(notifications.createdAt))
          .limit(limit)
          .offset(offset);

        socket.emit('notifications_loaded', { 
          notifications: userNotifications,
          hasMore: userNotifications.length === limit
        });

      } catch (error) {
        console.error('Get notifications error:', error);
        socket.emit('error', { message: 'Failed to load notifications' });
      }
    });

    // Get unread notification count
    socket.on('get_unread_count', async () => {
      try {
        if (!socket.userId) {
          socket.emit('error', { message: 'Not authenticated' });
          return;
        }

        const unreadCount = await this.getUnreadNotificationCount(socket.userId);
        socket.emit('unread_count_updated', { count: unreadCount });

      } catch (error) {
        console.error('Get unread count error:', error);
        socket.emit('error', { message: 'Failed to get unread count' });
      }
    });

    // Subscribe to notification types
    socket.on('subscribe_notifications', (data: { types: string[] }) => {
      const { types } = data;
      
      // Join notification type rooms
      types.forEach(type => {
        socket.join(`notifications:${type}`);
      });
      
      socket.emit('subscribed_to_notifications', { types });
      console.log(`User ${socket.user?.username} subscribed to notification types: ${types.join(', ')}`);
    });

    // Unsubscribe from notification types
    socket.on('unsubscribe_notifications', (data: { types: string[] }) => {
      const { types } = data;
      
      // Leave notification type rooms
      types.forEach(type => {
        socket.leave(`notifications:${type}`);
      });
      
      socket.emit('unsubscribed_from_notifications', { types });
      console.log(`User ${socket.user?.username} unsubscribed from notification types: ${types.join(', ')}`);
    });
  },

  // Helper method to get unread notification count
  async getUnreadNotificationCount(userId: string): Promise<number> {
    try {
      const result = await db()
        .select({ count: notifications.id })
        .from(notifications)
        .where(
          and(
            eq(notifications.userId, userId),
            eq(notifications.isRead, false)
          )
        );

      return result.length;
    } catch (error) {
      console.error('Get unread count error:', error);
      return 0;
    }
  },

  // Helper method to send notification to user
  async sendNotificationToUser(
    io: SocketIOServer, 
    notification: {
      userId: string;
      type: 'message' | 'mention' | 'reaction' | 'system';
      title: string;
      body: string;
      data?: any;
    }
  ) {
    try {
      // Create notification in database
      const [newNotification] = await db()
        .insert(notifications)
        .values({
          userId: notification.userId,
          type: notification.type,
          title: notification.title,
          body: notification.body,
          data: notification.data,
          isRead: false
        })
        .returning();

      // Send real-time notification to user
      io.to(`user:${notification.userId}`).emit('new_notification', newNotification);
      
      // Send to notification type room
      io.to(`notifications:${notification.type}`).emit('new_notification', newNotification);

      // Update unread count
      const unreadCount = await this.getUnreadNotificationCount(notification.userId);
      io.to(`user:${notification.userId}`).emit('unread_count_updated', { count: unreadCount });

      return newNotification;
    } catch (error) {
      console.error('Send notification error:', error);
      return null;
    }
  },

  // Helper method to send system-wide announcement
  async sendSystemAnnouncement(
    io: SocketIOServer,
    announcement: {
      title: string;
      content: string;
      metadata?: any;
      targetRoles?: string[];
    }
  ) {
    try {
      // Get target users based on roles
      let targetUsers;
      if (announcement.targetRoles && announcement.targetRoles.length > 0) {
        targetUsers = await db()
          .select({ id: users.id })
          .from(users)
          .where(eq(users.role, announcement.targetRoles[0]!)); // Non-null assertion since we check length > 0
      } else {
        targetUsers = await db()
          .select({ id: users.id })
          .from(users)
          .where(eq(users.isActive, true));
      }

      // Create notifications for all target users
      const notificationPromises = targetUsers.map(user =>
        this.sendNotificationToUser(io, {
          userId: user.id,
          type: 'system',
          title: announcement.title,
          body: announcement.content,
          data: announcement.metadata
        })
      );

      await Promise.all(notificationPromises);

      console.log(`System announcement sent to ${targetUsers.length} users`);
      return targetUsers.length;
    } catch (error) {
      console.error('Send system announcement error:', error);
      return 0;
    }
  }
};