import { Request, Response } from 'express';
import { eq, and, or, desc, asc, gte, sql } from 'drizzle-orm';
import db from '../db/db.js';
import { 
  messages, 
  conversations, 
  conversationMembers, 
  messageReactions,
  messageReceipts,
  attachments,
  users
} from '../db/schema.js';
import { AuthenticatedRequest } from '../infrastructure/auth/middleware/authenticate.js';
import { getSocketService } from '../websocket/SocketService.js';
import { messageHandler } from '../websocket/handlers/messageHandler.js';

export class MessageController {
  async sendMessage(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { 
        conversationId, 
        content, 
        type = 'text', 
        replyToId,
        forwardedFromId,
        metadata 
      } = req.body;

      if (!conversationId) {
        res.status(400).json({ error: 'Conversation ID is required' });
        return;
      }

      if (!content && type === 'text') {
        res.status(400).json({ error: 'Message content is required for text messages' });
        return;
      }

      const memberCheck = await db()
        .select()
        .from(conversationMembers)
        .where(
          and(
            eq(conversationMembers.conversationId, conversationId),
            eq(conversationMembers.userId, req.user.userId)
          )
        )
        .limit(1);

      if (memberCheck.length === 0) {
        res.status(403).json({ error: 'You are not a member of this conversation' });
        return;
      }

      const newMessage = await db().transaction(async (tx) => {
        const [message] = await tx
          .insert(messages)
          .values({
            conversationId,
            senderId: req.user!.id,
            type,
            content,
            replyToId,
            forwardedFromId,
            metadata
          })
          .returning();

        await tx
          .update(conversations)
          .set({
            lastMessageId: message?.id,
            lastMessageAt: message?.createdAt,
            updatedAt: new Date()
          })
          .where(eq(conversations.id, conversationId));

        const members = await tx
          .select({ userId: conversationMembers.userId })
          .from(conversationMembers)
          .where(
            and(
              eq(conversationMembers.conversationId, conversationId),
              sql`${conversationMembers.userId} != ${req.user!.id}`
            )
          );

        if (members.length > 0 && message?.id) {
          await tx.insert(messageReceipts).values(
            members.map(member => ({
              messageId: message.id,
              userId: member.userId,
              isDelivered: false,
              isRead: false
            }))
          );
        }

        return message;
      });

      // Broadcast new message via WebSocket
      try {
        const socketService = getSocketService();
        await messageHandler.broadcastNewMessage(socketService.getIO(), newMessage);
      } catch (socketError) {
        console.error('Socket broadcast error:', socketError);
        // Don't fail the request if socket broadcasting fails
      }

      res.status(201).json({ message: newMessage });
    } catch (error) {
      console.error('Send message error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to send message' 
      });
    }
  }

  async getMessages(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { conversationId } = req.params;
      const { limit = '50', offset = '0', before, after } = req.query;

      if (!conversationId) {
        res.status(400).json({ error: 'Conversation ID is required' });
        return;
      }

      const memberCheck = await db()
        .select()
        .from(conversationMembers)
        .where(
          and(
            eq(conversationMembers.conversationId, conversationId),
            eq(conversationMembers.userId, req.user.userId)
          )
        )
        .limit(1);

      if (memberCheck.length === 0) {
        res.status(403).json({ error: 'You are not a member of this conversation' });
        return;
      }

      let query = db()
        .select({
          id: messages.id,
          conversationId: messages.conversationId,
          senderId: messages.senderId,
          type: messages.type,
          content: messages.content,
          metadata: messages.metadata,
          replyToId: messages.replyToId,
          forwardedFromId: messages.forwardedFromId,
          isEdited: messages.isEdited,
          editedAt: messages.editedAt,
          isDeleted: messages.isDeleted,
          isPinned: messages.isPinned,
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
        .where(
          and(
            eq(messages.conversationId, conversationId),
            eq(messages.isDeleted, false)
          )
        )
        .$dynamic();

      if (before && typeof before === 'string') {
        const beforeDate = new Date(before);
        query = query.where(sql`${messages.createdAt} < ${beforeDate}`);
      }

      if (after && typeof after === 'string') {
        const afterDate = new Date(after);
        query = query.where(sql`${messages.createdAt} > ${afterDate}`);
      }

      const result = await query
        .orderBy(desc(messages.createdAt))
        .limit(parseInt(limit as string))
        .offset(parseInt(offset as string));

      await db()
        .update(conversationMembers)
        .set({
          lastReadAt: new Date(),
          unreadCount: 0
        })
        .where(
          and(
            eq(conversationMembers.conversationId, conversationId),
            eq(conversationMembers.userId, req.user.userId)
          )
        );

      res.status(200).json({ messages: result.reverse() });
    } catch (error) {
      console.error('Get messages error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to fetch messages' 
      });
    }
  }

  async editMessage(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { messageId } = req.params;
      const { content } = req.body;

      if (!messageId) {
        res.status(400).json({ error: 'Message ID is required' });
        return;
      }

      if (!content) {
        res.status(400).json({ error: 'Message content is required' });
        return;
      }

      const message = await db()
        .select()
        .from(messages)
        .where(eq(messages.id, messageId))
        .limit(1);

      if (message.length === 0) {
        res.status(404).json({ error: 'Message not found' });
        return;
      }

      if (message[0]?.senderId !== req.user.userId) {
        res.status(403).json({ error: 'You can only edit your own messages' });
        return;
      }

      if (message[0]?.isDeleted) {
        res.status(400).json({ error: 'Cannot edit deleted message' });
        return;
      }

      const updatedMessage = await db()
        .update(messages)
        .set({
          content,
          isEdited: true,
          editedAt: new Date()
        })
        .where(eq(messages.id, messageId))
        .returning();

      // Broadcast message update via WebSocket
      try {
        const socketService = getSocketService();
        await messageHandler.broadcastMessageUpdate(socketService.getIO(), updatedMessage[0], 'updated');
      } catch (socketError) {
        console.error('Socket broadcast error:', socketError);
      }

      res.status(200).json({ message: updatedMessage[0] });
    } catch (error) {
      console.error('Edit message error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to edit message' 
      });
    }
  }

  async deleteMessage(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { messageId } = req.params;

      if (!messageId) {
        res.status(400).json({ error: 'Message ID is required' });
        return;
      }

      const message = await db()
        .select()
        .from(messages)
        .where(eq(messages.id, messageId))
        .limit(1);

      if (message.length === 0) {
        res.status(404).json({ error: 'Message not found' });
        return;
      }

      const memberCheck = await db()
        .select({ role: conversationMembers.role })
        .from(conversationMembers)
        .where(
          and(
            eq(conversationMembers.conversationId, message[0]?.conversationId || ''),
            eq(conversationMembers.userId, req.user.userId)
          )
        )
        .limit(1);

      const canDelete = 
        message[0]?.senderId === req.user.userId || 
        memberCheck[0]?.role === 'admin' || 
        memberCheck[0]?.role === 'owner';

      if (!canDelete) {
        res.status(403).json({ error: 'You do not have permission to delete this message' });
        return;
      }

      await db()
        .update(messages)
        .set({
          isDeleted: true,
          deletedAt: new Date(),
          content: null
        })
        .where(eq(messages.id, messageId));

      // Broadcast message deletion via WebSocket
      try {
        const socketService = getSocketService();
        await messageHandler.broadcastMessageUpdate(socketService.getIO(), { id: messageId, conversationId: message[0]?.conversationId }, 'deleted');
      } catch (socketError) {
        console.error('Socket broadcast error:', socketError);
      }

      res.status(200).json({ message: 'Message deleted successfully' });
    } catch (error) {
      console.error('Delete message error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to delete message' 
      });
    }
  }

  async addReaction(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { messageId } = req.params;

      if (!messageId) {
        res.status(400).json({ error: 'Message ID is required' });
        return;
      }
      const { emoji } = req.body;

      if (!emoji) {
        res.status(400).json({ error: 'Emoji is required' });
        return;
      }

      const message = await db()
        .select({ conversationId: messages.conversationId })
        .from(messages)
        .where(eq(messages.id, messageId))
        .limit(1);

      if (message.length === 0) {
        res.status(404).json({ error: 'Message not found' });
        return;
      }

      const memberCheck = await db()
        .select()
        .from(conversationMembers)
        .where(
          and(
            eq(conversationMembers.conversationId, message[0]?.conversationId || ''),
            eq(conversationMembers.userId, req.user.userId)
          )
        )
        .limit(1);

      if (memberCheck.length === 0) {
        res.status(403).json({ error: 'You are not a member of this conversation' });
        return;
      }

      const existingReaction = await db()
        .select()
        .from(messageReactions)
        .where(
          and(
            eq(messageReactions.messageId, messageId),
            eq(messageReactions.userId, req.user.userId),
            eq(messageReactions.emoji, emoji)
          )
        )
        .limit(1);

      if (existingReaction.length > 0) {
        res.status(409).json({ error: 'Reaction already exists' });
        return;
      }

      const newReaction = await db()
        .insert(messageReactions)
        .values({
          messageId,
          userId: req.user.userId,
          emoji
        })
        .returning();

      // Broadcast reaction addition via WebSocket
      try {
        const socketService = getSocketService();
        await messageHandler.broadcastReactionUpdate(socketService.getIO(), newReaction[0], 'added');
      } catch (socketError) {
        console.error('Socket broadcast error:', socketError);
      }

      res.status(201).json({ reaction: newReaction[0] });
    } catch (error) {
      console.error('Add reaction error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to add reaction' 
      });
    }
  }

  async removeReaction(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { messageId } = req.params;

      if (!messageId) {
        res.status(400).json({ error: 'Message ID is required' });
        return;
      }
      const { emoji } = req.body;

      if (!emoji) {
        res.status(400).json({ error: 'Emoji is required' });
        return;
      }

      const deletedReaction = await db()
        .delete(messageReactions)
        .where(
          and(
            eq(messageReactions.messageId, messageId),
            eq(messageReactions.userId, req.user.userId),
            eq(messageReactions.emoji, emoji)
          )
        )
        .returning({ id: messageReactions.id });

      if (deletedReaction.length === 0) {
        res.status(404).json({ error: 'Reaction not found' });
        return;
      }

      // Broadcast reaction removal via WebSocket
      try {
        const socketService = getSocketService();
        await messageHandler.broadcastReactionUpdate(socketService.getIO(), { messageId, userId: req.user.userId, emoji }, 'removed');
      } catch (socketError) {
        console.error('Socket broadcast error:', socketError);
      }

      res.status(200).json({ message: 'Reaction removed successfully' });
    } catch (error) {
      console.error('Remove reaction error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to remove reaction' 
      });
    }
  }

  async markAsRead(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { messageId } = req.params;

      if (!messageId) {
        res.status(400).json({ error: 'Message ID is required' });
        return;
      }

      const receipt = await db()
        .update(messageReceipts)
        .set({
          isRead: true,
          readAt: new Date()
        })
        .where(
          and(
            eq(messageReceipts.messageId, messageId),
            eq(messageReceipts.userId, req.user.userId)
          )
        )
        .returning();

      if (receipt.length === 0) {
        res.status(404).json({ error: 'Message receipt not found' });
        return;
      }

      res.status(200).json({ receipt: receipt[0] });
    } catch (error) {
      console.error('Mark as read error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to mark message as read' 
      });
    }
  }

  async getConversations(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const userConversations = await db()
        .select({
          conversation: conversations,
          member: conversationMembers,
          lastMessage: {
            id: messages.id,
            content: messages.content,
            type: messages.type,
            senderId: messages.senderId,
            createdAt: messages.createdAt
          },
          lastMessageSender: {
            username: users.username,
            fullName: users.fullName
          }
        })
        .from(conversationMembers)
        .innerJoin(conversations, eq(conversationMembers.conversationId, conversations.id))
        .leftJoin(messages, eq(conversations.lastMessageId, messages.id))
        .leftJoin(users, eq(messages.senderId, users.id))
        .where(eq(conversationMembers.userId, req.user.userId))
        .orderBy(desc(conversations.lastMessageAt));

      res.status(200).json({ conversations: userConversations });
    } catch (error) {
      console.error('Get conversations error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to fetch conversations' 
      });
    }
  }

  async createConversation(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { name, description, type, memberIds, avatarUrl } = req.body;

      if (!type) {
        res.status(400).json({ error: 'Conversation type is required' });
        return;
      }

      if (type === 'direct' && (!memberIds || memberIds.length !== 1)) {
        res.status(400).json({ error: 'Direct conversations require exactly one other member' });
        return;
      }

      if ((type === 'group' || type === 'channel') && !name) {
        res.status(400).json({ error: 'Group and channel conversations require a name' });
        return;
      }

      const conversation = await db().transaction(async (tx) => {
        const [newConversation] = await tx
          .insert(conversations)
          .values({
            name,
            description,
            type,
            avatarUrl,
            createdById: req.user!.id
          })
          .returning();

        const members = [req.user!.id, ...(memberIds || [])];
        const uniqueMembers = Array.from(new Set(members));

        if (newConversation?.id) {
          await tx.insert(conversationMembers).values(
            uniqueMembers.map((memberId, index) => ({
              conversationId: newConversation.id,
              userId: memberId,
              role: (index === 0 ? 'owner' : 'member') as 'owner' | 'admin' | 'moderator' | 'member'
            }))
          );
        }

        return newConversation;
      });

      res.status(201).json({ conversation });
    } catch (error) {
      console.error('Create conversation error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to create conversation' 
      });
    }
  }

  async updateConversation(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { conversationId } = req.params;

      if (!conversationId) {
        res.status(400).json({ error: 'Conversation ID is required' });
        return;
      }
      const { name, description, avatarUrl } = req.body;

      const memberCheck = await db()
        .select({ role: conversationMembers.role })
        .from(conversationMembers)
        .where(
          and(
            eq(conversationMembers.conversationId, conversationId),
            eq(conversationMembers.userId, req.user.userId)
          )
        )
        .limit(1);

      if (memberCheck.length === 0) {
        res.status(403).json({ error: 'You are not a member of this conversation' });
        return;
      }

      if (memberCheck[0]?.role !== 'owner' && memberCheck[0]?.role !== 'admin') {
        res.status(403).json({ error: 'Only owners and admins can update conversation details' });
        return;
      }

      const updateData: any = { updatedAt: new Date() };
      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl;

      const updatedConversation = await db()
        .update(conversations)
        .set(updateData)
        .where(eq(conversations.id, conversationId))
        .returning();

      if (updatedConversation.length === 0) {
        res.status(404).json({ error: 'Conversation not found' });
        return;
      }

      res.status(200).json({ conversation: updatedConversation[0] });
    } catch (error) {
      console.error('Update conversation error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to update conversation' 
      });
    }
  }

  async addMember(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { conversationId } = req.params;

      if (!conversationId) {
        res.status(400).json({ error: 'Conversation ID is required' });
        return;
      }
      const { userId, role = 'member' as 'owner' | 'admin' | 'moderator' | 'member' } = req.body;

      if (!userId) {
        res.status(400).json({ error: 'User ID is required' });
        return;
      }

      const memberCheck = await db()
        .select({ role: conversationMembers.role })
        .from(conversationMembers)
        .where(
          and(
            eq(conversationMembers.conversationId, conversationId),
            eq(conversationMembers.userId, req.user.userId)
          )
        )
        .limit(1);

      if (memberCheck.length === 0) {
        res.status(403).json({ error: 'You are not a member of this conversation' });
        return;
      }

      if (memberCheck[0]?.role !== 'owner' && memberCheck[0]?.role !== 'admin') {
        res.status(403).json({ error: 'Only owners and admins can add members' });
        return;
      }

      const existingMember = await db()
        .select()
        .from(conversationMembers)
        .where(
          and(
            eq(conversationMembers.conversationId, conversationId),
            eq(conversationMembers.userId, userId)
          )
        )
        .limit(1);

      if (existingMember.length > 0) {
        res.status(409).json({ error: 'User is already a member of this conversation' });
        return;
      }

      const newMember = await db()
        .insert(conversationMembers)
        .values({
          conversationId,
          userId,
          role
        })
        .returning();

      res.status(201).json({ member: newMember[0] });
    } catch (error) {
      console.error('Add member error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to add member' 
      });
    }
  }

  async removeMember(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { conversationId, userId } = req.params;

      if (!conversationId || !userId) {
        res.status(400).json({ error: 'Conversation ID and User ID are required' });
        return;
      }

      const requestingMember = await db()
        .select({ role: conversationMembers.role })
        .from(conversationMembers)
        .where(
          and(
            eq(conversationMembers.conversationId, conversationId),
            eq(conversationMembers.userId, req.user.userId)
          )
        )
        .limit(1);

      if (requestingMember.length === 0) {
        res.status(403).json({ error: 'You are not a member of this conversation' });
        return;
      }

      const isLeaving = userId === req.user.userId;
      const canRemove = 
        isLeaving || 
        requestingMember[0]?.role === 'owner' || 
        requestingMember[0]?.role === 'admin';

      if (!canRemove) {
        res.status(403).json({ error: 'You do not have permission to remove members' });
        return;
      }

      const targetMember = await db()
        .select({ role: conversationMembers.role })
        .from(conversationMembers)
        .where(
          and(
            eq(conversationMembers.conversationId, conversationId),
            eq(conversationMembers.userId, userId)
          )
        )
        .limit(1);

      if (targetMember.length === 0) {
        res.status(404).json({ error: 'Member not found in conversation' });
        return;
      }

      if (targetMember[0]?.role === 'owner' && !isLeaving) {
        res.status(403).json({ error: 'Cannot remove the conversation owner' });
        return;
      }

      await db()
        .update(conversationMembers)
        .set({ leftAt: new Date() })
        .where(
          and(
            eq(conversationMembers.conversationId, conversationId),
            eq(conversationMembers.userId, userId)
          )
        );

      res.status(200).json({ message: 'Member removed successfully' });
    } catch (error) {
      console.error('Remove member error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to remove member' 
      });
    }
  }

  async broadcastMessage(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { content, type = 'text', recipientIds, metadata } = req.body;

      if (!content) {
        res.status(400).json({ error: 'Message content is required' });
        return;
      }

      if (!recipientIds || !Array.isArray(recipientIds) || recipientIds.length === 0) {
        res.status(400).json({ error: 'Recipients are required' });
        return;
      }

      const broadcastResults = await db().transaction(async (tx) => {
        const results = [];

        for (const recipientId of recipientIds) {
          const [conversation] = await tx
            .insert(conversations)
            .values({
              name: `Broadcast from ${req.user!.username}`,
              type: 'direct',
              createdById: req.user!.id
            })
            .returning();

          if (conversation?.id) {
            await tx.insert(conversationMembers).values([
              {
                conversationId: conversation.id,
                userId: req.user!.id,
                role: 'owner'
              },
              {
                conversationId: conversation.id,
                userId: recipientId,
                role: 'member'
              }
            ]);

            const [message] = await tx
              .insert(messages)
              .values({
                conversationId: conversation.id,
                senderId: req.user!.id,
                type,
                content,
                metadata
              })
              .returning();

            await tx
              .update(conversations)
              .set({
                lastMessageId: message?.id,
                lastMessageAt: message?.createdAt,
                updatedAt: new Date()
              })
              .where(eq(conversations.id, conversation.id));

            if (message?.id) {
              await tx.insert(messageReceipts).values({
                messageId: message.id,
                userId: recipientId,
                isDelivered: false,
                isRead: false
              });
            }

            results.push({
              recipientId,
              conversationId: conversation.id,
              messageId: message?.id
            });
          }
        }

        return results;
      });

      res.status(201).json({ 
        message: 'Broadcast sent successfully', 
        results: broadcastResults 
      });
    } catch (error) {
      console.error('Broadcast message error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to broadcast message' 
      });
    }
  }
}

export const messageController = new MessageController();