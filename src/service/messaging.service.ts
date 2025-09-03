import { eq, and, or, desc, sql, gte } from "drizzle-orm";
import db from "../db/db.js";
import {
  messages,
  conversations,
  conversationMembers,
  messageReceipts,
  messageReactions,
  notifications,
  users,
  userPresence,
} from "../db/schema.js";

export interface SendMessageData {
  conversationId: string;
  senderId: string;
  type: "text" | "image" | "video" | "audio" | "file" | "system";
  content?: string | null;
  metadata?: any;
  replyToId?: string;
  forwardedFromId?: string;
}

export interface CreateConversationData {
  name?: string;
  description?: string;
  type: "direct" | "group" | "channel";
  avatarUrl?: string;
  createdById: string;
  memberIds: string[];
}

export class MessagingService {
  async sendMessage(data: SendMessageData): Promise<any> {
    return await db().transaction(async (tx: any) => {
      const [message] = await tx
        .insert(messages)
        .values({
          conversationId: data.conversationId,
          senderId: data.senderId,
          type: data.type,
          content: data.content,
          metadata: data.metadata,
          replyToId: data.replyToId,
          forwardedFromId: data.forwardedFromId,
        })
        .returning();

      await tx
        .update(conversations)
        .set({
          lastMessageId: message.id,
          lastMessageAt: message.createdAt,
          updatedAt: new Date(),
        })
        .where(eq(conversations.id, data.conversationId));

      const members = await tx
        .select({ userId: conversationMembers.userId })
        .from(conversationMembers)
        .where(
          and(
            eq(conversationMembers.conversationId, data.conversationId),
            sql`${conversationMembers.userId} != ${data.senderId}`
          )
        );

      if (members.length > 0) {
        await tx.insert(messageReceipts).values(
          members.map((member: any) => ({
            messageId: message.id,
            userId: member.userId,
            isDelivered: false,
            isRead: false,
          }))
        );

        await tx
          .update(conversationMembers)
          .set({
            unreadCount: sql`${conversationMembers.unreadCount} + 1`,
          })
          .where(
            and(
              eq(conversationMembers.conversationId, data.conversationId),
              sql`${conversationMembers.userId} != ${data.senderId}`
            )
          );
      }

      return message;
    });
  }

  async createConversation(data: CreateConversationData): Promise<any> {
    return await db().transaction(async (tx: any) => {
      const [conversation] = await tx
        .insert(conversations)
        .values({
          name: data.name,
          description: data.description,
          type: data.type,
          avatarUrl: data.avatarUrl,
          createdById: data.createdById,
        })
        .returning();

      const uniqueMembers = [...new Set([data.createdById, ...data.memberIds])];

      await tx.insert(conversationMembers).values(
        uniqueMembers.map((userId, index) => ({
          conversationId: conversation.id,
          userId,
          role: userId === data.createdById ? "owner" : "member",
        }))
      );

      if (data.type === "direct" && uniqueMembers.length === 2) {
        const otherUserId = uniqueMembers.find((id) => id !== data.createdById);
        if (otherUserId) {
          const [otherUser] = await tx
            .select({ fullName: users.fullName })
            .from(users)
            .where(eq(users.id, otherUserId))
            .limit(1);

          if (otherUser && !data.name) {
            await tx
              .update(conversations)
              .set({ name: otherUser.fullName })
              .where(eq(conversations.id, conversation.id));
          }
        }
      }

      return conversation;
    });
  }

  async markMessagesAsRead(conversationId: string, userId: string): Promise<void> {
    await db().transaction(async (tx: any) => {
      const unreadMessages = await tx
        .select({ messageId: messageReceipts.messageId })
        .from(messageReceipts)
        .innerJoin(messages, eq(messageReceipts.messageId, messages.id))
        .where(
          and(
            eq(messages.conversationId, conversationId),
            eq(messageReceipts.userId, userId),
            eq(messageReceipts.isRead, false)
          )
        );

      if (unreadMessages.length > 0) {
        await tx
          .update(messageReceipts)
          .set({
            isRead: true,
            readAt: new Date(),
          })
          .where(
            and(
              sql`${messageReceipts.messageId} = ANY(${unreadMessages.map((m: any) => m.messageId)})`,
              eq(messageReceipts.userId, userId)
            )
          );

        await tx
          .update(conversationMembers)
          .set({
            unreadCount: 0,
            lastReadAt: new Date(),
          })
          .where(and(eq(conversationMembers.conversationId, conversationId), eq(conversationMembers.userId, userId)));
      }
    });
  }

  async getUnreadCount(userId: string): Promise<number> {
    const result = await db()
      .select({
        totalUnread: sql<number>`SUM(${conversationMembers.unreadCount})`,
      })
      .from(conversationMembers)
      .where(eq(conversationMembers.userId, userId));

    return result[0]?.totalUnread || 0;
  }

  async updateTypingStatus(userId: string, conversationId: string, isTyping: boolean): Promise<void> {
    await db()
      .update(userPresence)
      .set({
        isTyping,
        typingInConversationId: isTyping ? conversationId : null,
        updatedAt: new Date(),
      })
      .where(eq(userPresence.userId, userId));
  }

  async getTypingUsers(conversationId: string): Promise<any[]> {
    const typingUsers = await db()
      .select({
        user: {
          id: users.id,
          username: users.username,
          fullName: users.fullName,
          avatarUrl: users.avatarUrl,
        },
      })
      .from(userPresence)
      .innerJoin(users, eq(userPresence.userId, users.id))
      .where(
        and(
          eq(userPresence.typingInConversationId, conversationId),
          eq(userPresence.isTyping, true),
          gte(userPresence.updatedAt, new Date(Date.now() - 10000))
        )
      );

    return typingUsers;
  }

  async searchMessages(userId: string, query: string, conversationId?: string): Promise<any[]> {
    let searchQuery = db()
      .select({
        message: messages,
        conversation: {
          id: conversations.id,
          name: conversations.name,
          type: conversations.type,
        },
        sender: {
          id: users.id,
          username: users.username,
          fullName: users.fullName,
          avatarUrl: users.avatarUrl,
        },
      })
      .from(messages)
      .innerJoin(conversations, eq(messages.conversationId, conversations.id))
      .innerJoin(
        conversationMembers,
        and(eq(conversationMembers.conversationId, conversations.id), eq(conversationMembers.userId, userId))
      )
      .innerJoin(users, eq(messages.senderId, users.id))
      .where(and(eq(messages.isDeleted, false), sql`${messages.content} ILIKE ${"%" + query + "%"}`))
      .$dynamic();

    if (conversationId) {
      searchQuery = searchQuery.where(eq(messages.conversationId, conversationId));
    }

    const results = await searchQuery.orderBy(desc(messages.createdAt)).limit(50);

    return results;
  }

  async getPinnedMessages(conversationId: string): Promise<any[]> {
    const pinned = await db()
      .select({
        message: messages,
        sender: {
          id: users.id,
          username: users.username,
          fullName: users.fullName,
          avatarUrl: users.avatarUrl,
        },
        pinnedBy: {
          id: users.id,
          username: users.username,
        },
      })
      .from(messages)
      .innerJoin(users, eq(messages.senderId, users.id))
      .leftJoin(users as any, eq(messages.pinnedById, users.id))
      .where(
        and(eq(messages.conversationId, conversationId), eq(messages.isPinned, true), eq(messages.isDeleted, false))
      )
      .orderBy(desc(messages.pinnedAt));

    return pinned;
  }

  async deleteConversation(conversationId: string, userId: string): Promise<void> {
    await db().transaction(async (tx: any) => {
      const member = await tx
        .select({ role: conversationMembers.role })
        .from(conversationMembers)
        .where(and(eq(conversationMembers.conversationId, conversationId), eq(conversationMembers.userId, userId)))
        .limit(1);

      if (member[0]?.role === "owner") {
        await tx.delete(conversations).where(eq(conversations.id, conversationId));
      } else {
        await tx
          .update(conversationMembers)
          .set({ leftAt: new Date() })
          .where(and(eq(conversationMembers.conversationId, conversationId), eq(conversationMembers.userId, userId)));
      }
    });
  }

  async getMessageReactions(messageId: string): Promise<any[]> {
    const reactions = await db()
      .select({
        emoji: messageReactions.emoji,
        count: sql<number>`COUNT(*)`,
        users: sql<any[]>`
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'id', ${users.id},
              'username', ${users.username},
              'fullName', ${users.fullName}
            )
          )`,
      })
      .from(messageReactions)
      .innerJoin(users, eq(messageReactions.userId, users.id))
      .where(eq(messageReactions.messageId, messageId))
      .groupBy(messageReactions.emoji);

    return reactions;
  }

  async sendBroadcastMessage(
    senderId: string,
    conversationIds: string[],
    content: string,
    type: any = "text"
  ): Promise<void> {
    await db().transaction(async (tx: any) => {
      for (const conversationId of conversationIds) {
        const memberCheck = await tx
          .select()
          .from(conversationMembers)
          .where(and(eq(conversationMembers.conversationId, conversationId), eq(conversationMembers.userId, senderId)))
          .limit(1);

        if (memberCheck.length > 0) {
          await this.sendMessage({
            conversationId,
            senderId,
            type,
            content,
          });
        }
      }
    });
  }
}

export const messagingService = new MessagingService();
