import { Server as SocketIOServer, Socket } from 'socket.io';
import { eq, and, inArray, lt } from 'drizzle-orm';
import db from '../../db/db.js';
import { users, userPresence, userContacts } from '../../db/schema.js';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  user?: {
    id: string;
    username: string;
    role: string;
  };
}

export const presenceHandler = {
  setupPresenceHandlers(socket: AuthenticatedSocket, io: SocketIOServer) {
    // Update user status
    socket.on('update_status', async (data: { 
      status: 'online' | 'offline' | 'away' | 'busy' | 'invisible';
      statusMessage?: string;
    }) => {
      try {
        const { status, statusMessage } = data;
        
        if (!socket.userId) {
          socket.emit('error', { message: 'Not authenticated' });
          return;
        }

        // Update user status in database
        await db()
          .update(users)
          .set({
            status,
            statusMessage,
            lastSeenAt: new Date(),
            updatedAt: new Date()
          })
          .where(eq(users.id, socket.userId));

        // Update presence table
        await db()
          .insert(userPresence)
          .values({
            userId: socket.userId,
            status,
            lastActiveAt: new Date()
          })
          .onConflictDoUpdate({
            target: userPresence.userId,
            set: {
              status,
              lastActiveAt: new Date(),
              updatedAt: new Date()
            }
          });

        // Broadcast status update to contacts
        await this.broadcastStatusToContacts(io, socket.userId, {
          status,
          statusMessage,
          lastSeenAt: new Date()
        });

        socket.emit('status_updated', { status, statusMessage });
        
        console.log(`User ${socket.user?.username} updated status to ${status}`);
      } catch (error) {
        console.error('Update status error:', error);
        socket.emit('error', { message: 'Failed to update status' });
      }
    });

    // Get online contacts
    socket.on('get_online_contacts', async () => {
      try {
        if (!socket.userId) {
          socket.emit('error', { message: 'Not authenticated' });
          return;
        }

        const onlineContacts = await this.getOnlineContacts(socket.userId);
        socket.emit('online_contacts', { contacts: onlineContacts });

      } catch (error) {
        console.error('Get online contacts error:', error);
        socket.emit('error', { message: 'Failed to get online contacts' });
      }
    });

    // Start typing indicator
    socket.on('start_typing', async (data: { conversationId: string }) => {
      try {
        const { conversationId } = data;
        
        if (!socket.userId) return;

        // Update typing status in presence
        await db()
          .update(userPresence)
          .set({
            isTyping: true,
            typingInConversationId: conversationId,
            updatedAt: new Date()
          })
          .where(eq(userPresence.userId, socket.userId));

        // Broadcast typing indicator
        socket.to(`conversation:${conversationId}`).emit('typing_indicator', {
          userId: socket.userId,
          user: socket.user,
          conversationId,
          isTyping: true
        });

      } catch (error) {
        console.error('Start typing error:', error);
      }
    });

    // Stop typing indicator
    socket.on('stop_typing', async (data: { conversationId: string }) => {
      try {
        const { conversationId } = data;
        
        if (!socket.userId) return;

        // Update typing status in presence
        await db()
          .update(userPresence)
          .set({
            isTyping: false,
            typingInConversationId: null,
            updatedAt: new Date()
          })
          .where(eq(userPresence.userId, socket.userId));

        // Broadcast typing stop
        socket.to(`conversation:${conversationId}`).emit('typing_indicator', {
          userId: socket.userId,
          user: socket.user,
          conversationId,
          isTyping: false
        });

      } catch (error) {
        console.error('Stop typing error:', error);
      }
    });

    // Get user presence info
    socket.on('get_user_presence', async (data: { userIds: string[] }) => {
      try {
        if (!socket.userId) {
          socket.emit('error', { message: 'Not authenticated' });
          return;
        }

        const { userIds } = data;
        
        const presenceData = await db()
          .select({
            userId: userPresence.userId,
            status: userPresence.status,
            lastActiveAt: userPresence.lastActiveAt,
            isTyping: userPresence.isTyping,
            typingInConversationId: userPresence.typingInConversationId
          })
          .from(userPresence)
          .where(inArray(userPresence.userId, userIds));

        socket.emit('user_presence_data', { presenceData });

      } catch (error) {
        console.error('Get user presence error:', error);
        socket.emit('error', { message: 'Failed to get user presence' });
      }
    });
  },

  // Handle user connection
  async handleUserConnect(socket: AuthenticatedSocket, io: SocketIOServer) {
    try {
      if (!socket.userId) return;

      // Update user as online
      await db()
        .update(users)
        .set({
          status: 'online',
          lastSeenAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(users.id, socket.userId));

      // Update or create presence record
      await db()
        .insert(userPresence)
        .values({
          userId: socket.userId,
          status: 'online',
          lastActiveAt: new Date()
        })
        .onConflictDoUpdate({
          target: userPresence.userId,
          set: {
            status: 'online',
            lastActiveAt: new Date(),
            updatedAt: new Date()
          }
        });

      // Broadcast online status to contacts
      await this.broadcastStatusToContacts(io, socket.userId, {
        status: 'online',
        lastSeenAt: new Date()
      });

    } catch (error) {
      console.error('Handle user connect error:', error);
    }
  },

  // Handle user disconnection
  async handleUserDisconnect(socket: AuthenticatedSocket, io: SocketIOServer) {
    try {
      if (!socket.userId) return;

      // Update user as offline
      await db()
        .update(users)
        .set({
          status: 'offline',
          lastSeenAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(users.id, socket.userId));

      // Update presence record
      await db()
        .update(userPresence)
        .set({
          status: 'offline',
          lastActiveAt: new Date(),
          isTyping: false,
          typingInConversationId: null,
          updatedAt: new Date()
        })
        .where(eq(userPresence.userId, socket.userId));

      // Broadcast offline status to contacts
      await this.broadcastStatusToContacts(io, socket.userId, {
        status: 'offline',
        lastSeenAt: new Date()
      });

    } catch (error) {
      console.error('Handle user disconnect error:', error);
    }
  },

  // Helper method to broadcast status to user's contacts
  async broadcastStatusToContacts(
    io: SocketIOServer,
    userId: string,
    statusUpdate: {
      status: string;
      statusMessage?: string;
      lastSeenAt: Date;
    }
  ) {
    try {
      // Get user's contacts
      const contacts = await db()
        .select({ contactId: userContacts.contactId })
        .from(userContacts)
        .where(
          and(
            eq(userContacts.userId, userId),
            eq(userContacts.isBlocked, false)
          )
        );

      // Get user info
      const user = await db()
        .select({
          id: users.id,
          username: users.username,
          fullName: users.fullName,
          avatarUrl: users.avatarUrl
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (user.length === 0) return;

      // Broadcast to each contact
      contacts.forEach(contact => {
        io.to(`user:${contact.contactId}`).emit('contact_status_update', {
          user: user[0],
          ...statusUpdate
        });
      });

    } catch (error) {
      console.error('Broadcast status to contacts error:', error);
    }
  },

  // Helper method to get online contacts
  async getOnlineContacts(userId: string) {
    try {
      const onlineContacts = await db()
        .select({
          contact: {
            id: users.id,
            username: users.username,
            fullName: users.fullName,
            displayName: users.displayName,
            avatarUrl: users.avatarUrl,
            status: users.status,
            statusMessage: users.statusMessage,
            lastSeenAt: users.lastSeenAt
          },
          presence: {
            lastActiveAt: userPresence.lastActiveAt,
            isTyping: userPresence.isTyping
          },
          contactInfo: {
            nickname: userContacts.nickname,
            isFavorite: userContacts.isFavorite
          }
        })
        .from(userContacts)
        .innerJoin(users, eq(userContacts.contactId, users.id))
        .leftJoin(userPresence, eq(users.id, userPresence.userId))
        .where(
          and(
            eq(userContacts.userId, userId),
            eq(userContacts.isBlocked, false),
            eq(users.status, 'online')
          )
        );

      return onlineContacts;
    } catch (error) {
      console.error('Get online contacts error:', error);
      return [];
    }
  },

  // Helper method to cleanup stale presence data
  async cleanupStalePresence(io: SocketIOServer) {
    try {
      const staleThreshold = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes ago

      // Find users who appear online but haven't been seen recently
      const staleUsers = await db()
        .select({ userId: userPresence.userId })
        .from(userPresence)
        .where(
          and(
            eq(userPresence.status, 'online'),
            lt(userPresence.lastActiveAt, staleThreshold)
          )
        );

      if (staleUsers.length > 0) {
        // Mark them as offline
        await db()
          .update(userPresence)
          .set({
            status: 'offline',
            updatedAt: new Date()
          })
          .where(inArray(userPresence.userId, staleUsers.map(u => u.userId)));

        // Update users table
        await db()
          .update(users)
          .set({
            status: 'offline',
            updatedAt: new Date()
          })
          .where(inArray(users.id, staleUsers.map(u => u.userId)));

        console.log(`Cleaned up ${staleUsers.length} stale presence records`);
      }
    } catch (error) {
      console.error('Cleanup stale presence error:', error);
    }
  }
};