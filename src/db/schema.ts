import {
  pgTable,
  serial,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  uuid,
  pgEnum,
  index,
  uniqueIndex,
  primaryKey,
  json,
} from "drizzle-orm/pg-core";
import { InferSelectModel, relations } from "drizzle-orm";

export const currencyEnum = pgEnum("currency", ["USD", "EUR", "GBP"]);
export const userStatusEnum = pgEnum("user_status", ["online", "offline", "away", "busy", "invisible"]);
export const messageTypeEnum = pgEnum("message_type", ["text", "image", "video", "audio", "file", "system"]);
export const conversationTypeEnum = pgEnum("conversation_type", ["direct", "group", "channel"]);
export const notificationTypeEnum = pgEnum("notification_type", ["message", "mention", "reaction", "system"]);
export const memberRoleEnum = pgEnum("member_role", ["owner", "admin", "moderator", "member"]);
export const reactionTypeEnum = pgEnum("reaction_type", ["like", "love", "laugh", "wow", "sad", "angry"]);
export const eventTypeEnum = pgEnum("event_type", ["training", "match", "meeting", "social", "other"]);
export const eventStatusEnum = pgEnum("event_status", ["scheduled", "in_progress", "completed", "cancelled", "postponed"]);

export const accountTable = pgTable(
  "account",
  {
    id: serial("id").primaryKey(),
    email: varchar("email", { length: 255 }).notNull(),
    firstName: varchar("first_name", { length: 255 }).notNull(),
    lastName: varchar("last_name", { length: 255 }).notNull(),
    currency: currencyEnum("currency").notNull().default("USD"),
    balance: integer("balance").notNull().default(0),
  },
  (table) => ({
    emailIdx: index("account_email_idx").on(table.email),
  })
);

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    username: varchar("username", { length: 50 }).notNull().unique(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    firstName: varchar("first_name", { length: 100 }),
    lastName: varchar("last_name", { length: 100 }),
    fullName: varchar("full_name", { length: 200 }),
    displayName: varchar("display_name", { length: 100 }),
    bio: text("bio"),
    avatarUrl: text("avatar_url"),
    phoneNumber: varchar("phone_number", { length: 20 }),
    role: varchar("role", { length: 50 }).default("player").notNull(),
    status: userStatusEnum("status").default("offline").notNull(),
    statusMessage: varchar("status_message", { length: 255 }),
    lastSeenAt: timestamp("last_seen_at", { mode: "date" }),
    isEmailVerified: boolean("is_email_verified").default(false).notNull(),
    isPhoneVerified: boolean("is_phone_verified").default(false).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    isTwoFactorEnabled: boolean("is_two_factor_enabled").default(false).notNull(),
    notificationSettings: json("notification_settings")
      .$type<{
        email: boolean;
        push: boolean;
        sound: boolean;
        desktop: boolean;
      }>()
      .default({ email: true, push: true, sound: true, desktop: true }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    emailIdx: uniqueIndex("users_email_idx").on(table.email),
    usernameIdx: uniqueIndex("users_username_idx").on(table.username),
    statusIdx: index("users_status_idx").on(table.status),
    createdAtIdx: index("users_created_at_idx").on(table.createdAt),
  })
);

export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 255 }),
    description: text("description"),
    type: conversationTypeEnum("type").notNull(),
    avatarUrl: text("avatar_url"),
    isArchived: boolean("is_archived").default(false).notNull(),
    isPinned: boolean("is_pinned").default(false).notNull(),
    lastMessageId: uuid("last_message_id"),
    lastMessageAt: timestamp("last_message_at", { mode: "date" }),
    metadata: json("metadata").$type<Record<string, any>>(),
    createdById: uuid("created_by_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    typeIdx: index("conversations_type_idx").on(table.type),
    lastMessageAtIdx: index("conversations_last_message_at_idx").on(table.lastMessageAt),
    createdByIdx: index("conversations_created_by_idx").on(table.createdById),
    archivedIdx: index("conversations_archived_idx").on(table.isArchived),
  })
);

export const conversationMembers = pgTable(
  "conversation_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: memberRoleEnum("role").default("member").notNull(),
    nickname: varchar("nickname", { length: 100 }),
    isMuted: boolean("is_muted").default(false).notNull(),
    mutedUntil: timestamp("muted_until", { mode: "date" }),
    isPinned: boolean("is_pinned").default(false).notNull(),
    lastReadMessageId: uuid("last_read_message_id"),
    lastReadAt: timestamp("last_read_at", { mode: "date" }),
    unreadCount: integer("unread_count").default(0).notNull(),
    joinedAt: timestamp("joined_at", { mode: "date" }).defaultNow().notNull(),
    leftAt: timestamp("left_at", { mode: "date" }),
  },
  (table) => ({
    conversationUserUnique: uniqueIndex("conversation_members_unique").on(table.conversationId, table.userId),
    conversationIdx: index("conversation_members_conversation_idx").on(table.conversationId),
    userIdx: index("conversation_members_user_idx").on(table.userId),
    lastReadAtIdx: index("conversation_members_last_read_at_idx").on(table.lastReadAt),
  })
);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    senderId: uuid("sender_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    replyToId: uuid("reply_to_id"),
    forwardedFromId: uuid("forwarded_from_id"),
    type: messageTypeEnum("type").notNull(),
    content: text("content"),
    metadata: json("metadata").$type<{
      fileName?: string;
      fileSize?: number;
      mimeType?: string;
      duration?: number;
      width?: number;
      height?: number;
      url?: string;
    }>(),
    isEdited: boolean("is_edited").default(false).notNull(),
    editedAt: timestamp("edited_at", { mode: "date" }),
    isDeleted: boolean("is_deleted").default(false).notNull(),
    deletedAt: timestamp("deleted_at", { mode: "date" }),
    isPinned: boolean("is_pinned").default(false).notNull(),
    pinnedAt: timestamp("pinned_at", { mode: "date" }),
    pinnedById: uuid("pinned_by_id").references(() => users.id),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    conversationIdx: index("messages_conversation_idx").on(table.conversationId),
    senderIdx: index("messages_sender_idx").on(table.senderId),
    createdAtIdx: index("messages_created_at_idx").on(table.createdAt),
    conversationCreatedAtIdx: index("messages_conversation_created_at_idx").on(table.conversationId, table.createdAt),
    replyToIdx: index("messages_reply_to_idx").on(table.replyToId),
    typeIdx: index("messages_type_idx").on(table.type),
    deletedIdx: index("messages_deleted_idx").on(table.isDeleted),
  })
);

export const messageReactions = pgTable(
  "message_reactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    messageId: uuid("message_id")
      .notNull()
      .references(() => messages.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    emoji: varchar("emoji", { length: 10 }).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    messageUserEmojiUnique: uniqueIndex("message_reactions_unique").on(table.messageId, table.userId, table.emoji),
    messageIdx: index("message_reactions_message_idx").on(table.messageId),
    userIdx: index("message_reactions_user_idx").on(table.userId),
  })
);

export const messageReceipts = pgTable(
  "message_receipts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    messageId: uuid("message_id")
      .notNull()
      .references(() => messages.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    isDelivered: boolean("is_delivered").default(false).notNull(),
    deliveredAt: timestamp("delivered_at", { mode: "date" }),
    isRead: boolean("is_read").default(false).notNull(),
    readAt: timestamp("read_at", { mode: "date" }),
  },
  (table) => ({
    messageUserUnique: uniqueIndex("message_receipts_unique").on(table.messageId, table.userId),
    messageIdx: index("message_receipts_message_idx").on(table.messageId),
    userIdx: index("message_receipts_user_idx").on(table.userId),
    deliveredIdx: index("message_receipts_delivered_idx").on(table.isDelivered),
    readIdx: index("message_receipts_read_idx").on(table.isRead),
  })
);

export const attachments = pgTable(
  "attachments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    messageId: uuid("message_id")
      .notNull()
      .references(() => messages.id, { onDelete: "cascade" }),
    fileName: varchar("file_name", { length: 255 }).notNull(),
    fileSize: integer("file_size").notNull(),
    mimeType: varchar("mime_type", { length: 100 }).notNull(),
    url: text("url").notNull(),
    thumbnailUrl: text("thumbnail_url"),
    metadata: json("metadata").$type<Record<string, any>>(),
    uploadedAt: timestamp("uploaded_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    messageIdx: index("attachments_message_idx").on(table.messageId),
    mimeTypeIdx: index("attachments_mime_type_idx").on(table.mimeType),
  })
);

export const userContacts = pgTable(
  "user_contacts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    nickname: varchar("nickname", { length: 100 }),
    isBlocked: boolean("is_blocked").default(false).notNull(),
    isFavorite: boolean("is_favorite").default(false).notNull(),
    addedAt: timestamp("added_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    userContactUnique: uniqueIndex("user_contacts_unique").on(table.userId, table.contactId),
    userIdx: index("user_contacts_user_idx").on(table.userId),
    contactIdx: index("user_contacts_contact_idx").on(table.contactId),
    blockedIdx: index("user_contacts_blocked_idx").on(table.isBlocked),
    favoriteIdx: index("user_contacts_favorite_idx").on(table.isFavorite),
  })
);

export const events = pgTable(
  "events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    type: eventTypeEnum("type").notNull(),
    status: eventStatusEnum("status").default("scheduled").notNull(),
    location: varchar("location", { length: 500 }),
    startTime: timestamp("start_time", { mode: "date" }).notNull(),
    endTime: timestamp("end_time", { mode: "date" }).notNull(),
    isAllDay: boolean("is_all_day").default(false).notNull(),
    createdById: uuid("created_by_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    maxParticipants: integer("max_participants"),
    isPublic: boolean("is_public").default(true).notNull(),
    requiresRsvp: boolean("requires_rsvp").default(false).notNull(),
    metadata: json("metadata").$type<{
      teamIds?: string[];
      tags?: string[];
      customFields?: Record<string, any>;
    }>(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    createdByIdx: index("events_created_by_idx").on(table.createdById),
    startTimeIdx: index("events_start_time_idx").on(table.startTime),
    endTimeIdx: index("events_end_time_idx").on(table.endTime),
    typeIdx: index("events_type_idx").on(table.type),
    statusIdx: index("events_status_idx").on(table.status),
    publicIdx: index("events_public_idx").on(table.isPublic),
  })
);

export const eventParticipants = pgTable(
  "event_participants",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: varchar("status", { length: 50 })
      .notNull()
      .default("invited")
      .$type<"invited" | "accepted" | "declined" | "maybe" | "attended" | "no_show">(),
    role: varchar("role", { length: 50 })
      .notNull()
      .default("participant")
      .$type<"organizer" | "participant" | "spectator">(),
    notes: text("notes"),
    responseAt: timestamp("response_at", { mode: "date" }),
    checkInAt: timestamp("check_in_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    eventUserUnique: uniqueIndex("event_participants_unique").on(table.eventId, table.userId),
    eventIdx: index("event_participants_event_idx").on(table.eventId),
    userIdx: index("event_participants_user_idx").on(table.userId),
    statusIdx: index("event_participants_status_idx").on(table.status),
  })
);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: notificationTypeEnum("type").notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    body: text("body"),
    data: json("data").$type<Record<string, any>>(),
    isRead: boolean("is_read").default(false).notNull(),
    readAt: timestamp("read_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index("notifications_user_idx").on(table.userId),
    typeIdx: index("notifications_type_idx").on(table.type),
    isReadIdx: index("notifications_is_read_idx").on(table.isRead),
    createdAtIdx: index("notifications_created_at_idx").on(table.createdAt),
    userIsReadIdx: index("notifications_user_is_read_idx").on(table.userId, table.isRead),
  })
);

export const userSessions = pgTable(
  "user_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    refreshToken: varchar("refresh_token", { length: 255 }).notNull().unique(),
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: text("user_agent"),
    deviceInfo: json("device_info").$type<{
      type?: string;
      os?: string;
      browser?: string;
    }>(),
    isValid: boolean("is_valid").default(true).notNull(),
    lastActivityAt: timestamp("last_activity_at", { mode: "date" }).defaultNow().notNull(),
    expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    refreshTokenIdx: uniqueIndex("user_sessions_refresh_token_idx").on(table.refreshToken),
    userIdx: index("user_sessions_user_idx").on(table.userId),
    expiresAtIdx: index("user_sessions_expires_at_idx").on(table.expiresAt),
    isValidIdx: index("user_sessions_is_valid_idx").on(table.isValid),
  })
);

export const userPresence = pgTable(
  "user_presence",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" })
      .unique(),
    status: userStatusEnum("status").notNull(),
    lastActiveAt: timestamp("last_active_at", { mode: "date" }).defaultNow().notNull(),
    currentConversationId: uuid("current_conversation_id").references(() => conversations.id, { onDelete: "set null" }),
    isTyping: boolean("is_typing").default(false).notNull(),
    typingInConversationId: uuid("typing_in_conversation_id").references(() => conversations.id, {
      onDelete: "set null",
    }),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    userIdx: uniqueIndex("user_presence_user_idx").on(table.userId),
    statusIdx: index("user_presence_status_idx").on(table.status),
    lastActiveIdx: index("user_presence_last_active_idx").on(table.lastActiveAt),
  })
);

export const usersRelations = relations(users, ({ many, one }) => ({
  conversations: many(conversationMembers),
  messages: many(messages),
  notifications: many(notifications),
  sessions: many(userSessions),
  contacts: many(userContacts, { relationName: "userContacts" }),
  contactOf: many(userContacts, { relationName: "contactOf" }),
  reactions: many(messageReactions),
  receipts: many(messageReceipts),
  presence: one(userPresence),
  createdConversations: many(conversations),
  createdEvents: many(events),
  eventParticipations: many(eventParticipants),
}));

export const conversationsRelations = relations(conversations, ({ many, one }) => ({
  members: many(conversationMembers),
  messages: many(messages),
  creator: one(users, {
    fields: [conversations.createdById],
    references: [users.id],
  }),
  lastMessage: one(messages, {
    fields: [conversations.lastMessageId],
    references: [messages.id],
  }),
}));

export const conversationMembersRelations = relations(conversationMembers, ({ one }) => ({
  conversation: one(conversations, {
    fields: [conversationMembers.conversationId],
    references: [conversations.id],
  }),
  user: one(users, {
    fields: [conversationMembers.userId],
    references: [users.id],
  }),
  lastReadMessage: one(messages, {
    fields: [conversationMembers.lastReadMessageId],
    references: [messages.id],
  }),
}));

export const messagesRelations = relations(messages, ({ one, many }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
  sender: one(users, {
    fields: [messages.senderId],
    references: [users.id],
  }),
  replyTo: one(messages, {
    fields: [messages.replyToId],
    references: [messages.id],
    relationName: "messageReplies",
  }),
  replies: many(messages, { relationName: "messageReplies" }),
  forwardedFrom: one(messages, {
    fields: [messages.forwardedFromId],
    references: [messages.id],
    relationName: "messageForwards",
  }),
  forwards: many(messages, { relationName: "messageForwards" }),
  reactions: many(messageReactions),
  receipts: many(messageReceipts),
  attachments: many(attachments),
  pinnedBy: one(users, {
    fields: [messages.pinnedById],
    references: [users.id],
  }),
}));

export const messageReactionsRelations = relations(messageReactions, ({ one }) => ({
  message: one(messages, {
    fields: [messageReactions.messageId],
    references: [messages.id],
  }),
  user: one(users, {
    fields: [messageReactions.userId],
    references: [users.id],
  }),
}));

export const messageReceiptsRelations = relations(messageReceipts, ({ one }) => ({
  message: one(messages, {
    fields: [messageReceipts.messageId],
    references: [messages.id],
  }),
  user: one(users, {
    fields: [messageReceipts.userId],
    references: [users.id],
  }),
}));

export const attachmentsRelations = relations(attachments, ({ one }) => ({
  message: one(messages, {
    fields: [attachments.messageId],
    references: [messages.id],
  }),
}));

export const userContactsRelations = relations(userContacts, ({ one }) => ({
  user: one(users, {
    fields: [userContacts.userId],
    references: [users.id],
    relationName: "userContacts",
  }),
  contact: one(users, {
    fields: [userContacts.contactId],
    references: [users.id],
    relationName: "contactOf",
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
}));

export const userSessionsRelations = relations(userSessions, ({ one }) => ({
  user: one(users, {
    fields: [userSessions.userId],
    references: [users.id],
  }),
}));

export const userPresenceRelations = relations(userPresence, ({ one }) => ({
  user: one(users, {
    fields: [userPresence.userId],
    references: [users.id],
  }),
  currentConversation: one(conversations, {
    fields: [userPresence.currentConversationId],
    references: [conversations.id],
    relationName: "currentConversation",
  }),
  typingInConversation: one(conversations, {
    fields: [userPresence.typingInConversationId],
    references: [conversations.id],
    relationName: "typingConversation",
  }),
}));

export const eventsRelations = relations(events, ({ one, many }) => ({
  creator: one(users, {
    fields: [events.createdById],
    references: [users.id],
  }),
  participants: many(eventParticipants),
}));

export const eventParticipantsRelations = relations(eventParticipants, ({ one }) => ({
  event: one(events, {
    fields: [eventParticipants.eventId],
    references: [events.id],
  }),
  user: one(users, {
    fields: [eventParticipants.userId],
    references: [users.id],
  }),
}));

// infer types of schema tables
export type User = InferSelectModel<typeof users>;
export type Conversation = InferSelectModel<typeof conversations>;
export type ConversationMember = InferSelectModel<typeof conversationMembers>;
export type Message = InferSelectModel<typeof messages>;
export type MessageReaction = InferSelectModel<typeof messageReactions>;
export type MessageReceipt = InferSelectModel<typeof messageReceipts>;
export type Attachment = InferSelectModel<typeof attachments>;
export type Notification = InferSelectModel<typeof notifications>;
export type UserSession = InferSelectModel<typeof userSessions>;
export type UserContact = InferSelectModel<typeof userContacts>;
export type UserPresence = InferSelectModel<typeof userPresence>;
export type Event = InferSelectModel<typeof events>;
export type EventParticipant = InferSelectModel<typeof eventParticipants>;
