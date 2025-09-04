import { Server as SocketIOServer, Socket } from 'socket.io';
import { eq, and, isNull } from 'drizzle-orm';
import db from '../../db/db.js';
import { conversations, conversationMembers, messages, messageReceipts, users } from '../../db/schema.js';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  user?: {
    id: string;
    username: string;
    role: string;
  };
}

export const messageHandler = {
  setupMessageHandlers(socket: AuthenticatedSocket, io: SocketIOServer) {
    // Join conversation rooms
    socket.on('join_conversation', async (data: { conversationId: string }) => {
      try {
        const { conversationId } = data;
        
        if (!socket.userId) {
          socket.emit('error', { message: 'Not authenticated' });
          return;
        }

        // Verify user is member of conversation
        const memberCheck = await db()
          .select()
          .from(conversationMembers)
          .where(
            and(
              eq(conversationMembers.conversationId, conversationId),
              eq(conversationMembers.userId, socket.userId)
            )
          )
          .limit(1);

        if (memberCheck.length === 0) {
          socket.emit('error', { message: 'Not authorized to join this conversation' });
          return;
        }

        // Join the conversation room
        socket.join(`conversation:${conversationId}`);
        
        // Notify others in the conversation
        socket.to(`conversation:${conversationId}`).emit('user_joined_conversation', {
          conversationId,
          user: socket.user
        });

        socket.emit('joined_conversation', { conversationId });
        
        console.log(`User ${socket.user?.username} joined conversation ${conversationId}`);
      } catch (error) {
        console.error('Join conversation error:', error);
        socket.emit('error', { message: 'Failed to join conversation' });
      }
    });

    // Leave conversation rooms
    socket.on('leave_conversation', (data: { conversationId: string }) => {
      const { conversationId } = data;
      socket.leave(`conversation:${conversationId}`);
      
      // Notify others in the conversation
      socket.to(`conversation:${conversationId}`).emit('user_left_conversation', {
        conversationId,
        user: socket.user
      });

      socket.emit('left_conversation', { conversationId });
      
      console.log(`User ${socket.user?.username} left conversation ${conversationId}`);
    });

    // Handle typing indicators
    socket.on('typing_start', (data: { conversationId: string }) => {
      const { conversationId } = data;
      socket.to(`conversation:${conversationId}`).emit('user_typing', {
        conversationId,
        user: socket.user,
        isTyping: true
      });
    });

    socket.on('typing_stop', (data: { conversationId: string }) => {
      const { conversationId } = data;
      socket.to(`conversation:${conversationId}`).emit('user_typing', {
        conversationId,
        user: socket.user,
        isTyping: false
      });
    });

    // Handle message acknowledgments
    socket.on('message_delivered', async (data: { messageId: string }) => {
      try {
        const { messageId } = data;
        
        if (!socket.userId) return;

        // Update message receipt as delivered
        await db()
          .update(messageReceipts)
          .set({
            isDelivered: true,
            deliveredAt: new Date()
          })
          .where(
            and(
              eq(messageReceipts.messageId, messageId),
              eq(messageReceipts.userId, socket.userId)
            )
          );

        // Notify sender that message was delivered
        const message = await db()
          .select({ senderId: messages.senderId, conversationId: messages.conversationId })
          .from(messages)
          .where(eq(messages.id, messageId))
          .limit(1);

        if (message.length > 0) {
          io.to(`user:${message[0]?.senderId}`).emit('message_delivery_update', {
            messageId,
            userId: socket.userId,
            status: 'delivered'
          });
        }
      } catch (error) {
        console.error('Message delivered error:', error);
      }
    });

    socket.on('message_read', async (data: { messageId: string }) => {
      try {
        const { messageId } = data;
        
        if (!socket.userId) return;

        // Update message receipt as read
        await db()
          .update(messageReceipts)
          .set({
            isRead: true,
            readAt: new Date()
          })
          .where(
            and(
              eq(messageReceipts.messageId, messageId),
              eq(messageReceipts.userId, socket.userId)
            )
          );

        // Notify sender that message was read
        const message = await db()
          .select({ senderId: messages.senderId, conversationId: messages.conversationId })
          .from(messages)
          .where(eq(messages.id, messageId))
          .limit(1);

        if (message.length > 0) {
          io.to(`user:${message[0]?.senderId}`).emit('message_read_update', {
            messageId,
            userId: socket.userId,
            status: 'read'
          });
        }
      } catch (error) {
        console.error('Message read error:', error);
      }
    });
  },

  // Helper method to broadcast new messages to conversation members
  async broadcastNewMessage(io: SocketIOServer, messageData: any) {
    try {
      const { conversationId, senderId } = messageData;
      
      // Get message with sender info
      const messageWithSender = await db()
        .select({
          id: messages.id,
          conversationId: messages.conversationId,
          senderId: messages.senderId,
          type: messages.type,
          content: messages.content,
          metadata: messages.metadata,
          replyToId: messages.replyToId,
          forwardedFromId: messages.forwardedFromId,
          createdAt: messages.createdAt,
          sender: {
            id: users.id,
            username: users.username,
            fullName: users.fullName,
            avatarUrl: users.avatarUrl
          }
        })
        .from(messages)
        .innerJoin(users, eq(messages.senderId, users.id))
        .where(eq(messages.id, messageData.id))
        .limit(1);

      if (messageWithSender.length === 0) return;

      const message = messageWithSender[0];
      
      // Broadcast to all conversation members except sender
      io.to(`conversation:${conversationId}`).emit('new_message', {
        message,
        conversationId
      });

      // Get conversation members for individual notifications
      const members = await db()
        .select({ userId: conversationMembers.userId })
        .from(conversationMembers)
        .where(
          and(
            eq(conversationMembers.conversationId, conversationId),
            isNull(conversationMembers.leftAt)
          )
        );

      // Send individual notifications to offline users
      for (const member of members) {
        if (member.userId !== senderId) {
          io.to(`user:${member.userId}`).emit('message_notification', {
            message,
            conversationId
          });
        }
      }

    } catch (error) {
      console.error('Broadcast new message error:', error);
    }
  },

  // Helper method to broadcast message updates (edits, deletes)
  async broadcastMessageUpdate(io: SocketIOServer, messageData: any, action: 'updated' | 'deleted') {
    try {
      const { conversationId } = messageData;
      
      io.to(`conversation:${conversationId}`).emit('message_updated', {
        message: messageData,
        action,
        conversationId
      });

    } catch (error) {
      console.error('Broadcast message update error:', error);
    }
  },

  // Helper method to broadcast reaction updates
  async broadcastReactionUpdate(io: SocketIOServer, reactionData: any, action: 'added' | 'removed') {
    try {
      // Get message and conversation info
      const message = await db()
        .select({ conversationId: messages.conversationId })
        .from(messages)
        .where(eq(messages.id, reactionData.messageId))
        .limit(1);

      if (message.length === 0) return;

      io.to(`conversation:${message[0]?.conversationId}`).emit('reaction_updated', {
        reaction: reactionData,
        action,
        messageId: reactionData.messageId,
        conversationId: message[0]?.conversationId
      });

    } catch (error) {
      console.error('Broadcast reaction update error:', error);
    }
  }
};