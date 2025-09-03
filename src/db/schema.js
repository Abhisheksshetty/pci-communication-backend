"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.eventParticipantsRelations = exports.eventsRelations = exports.userPresenceRelations = exports.userSessionsRelations = exports.notificationsRelations = exports.userContactsRelations = exports.attachmentsRelations = exports.messageReceiptsRelations = exports.messageReactionsRelations = exports.messagesRelations = exports.conversationMembersRelations = exports.conversationsRelations = exports.usersRelations = exports.userPresence = exports.userSessions = exports.notifications = exports.eventParticipants = exports.events = exports.userContacts = exports.attachments = exports.messageReceipts = exports.messageReactions = exports.messages = exports.conversationMembers = exports.conversations = exports.users = exports.accountTable = exports.eventStatusEnum = exports.eventTypeEnum = exports.reactionTypeEnum = exports.memberRoleEnum = exports.notificationTypeEnum = exports.conversationTypeEnum = exports.messageTypeEnum = exports.userStatusEnum = exports.currencyEnum = void 0;
var pg_core_1 = require("drizzle-orm/pg-core");
var drizzle_orm_1 = require("drizzle-orm");
exports.currencyEnum = (0, pg_core_1.pgEnum)("currency", ["USD", "EUR", "GBP"]);
exports.userStatusEnum = (0, pg_core_1.pgEnum)("user_status", ["online", "offline", "away", "busy", "invisible"]);
exports.messageTypeEnum = (0, pg_core_1.pgEnum)("message_type", ["text", "image", "video", "audio", "file", "system"]);
exports.conversationTypeEnum = (0, pg_core_1.pgEnum)("conversation_type", ["direct", "group", "channel"]);
exports.notificationTypeEnum = (0, pg_core_1.pgEnum)("notification_type", ["message", "mention", "reaction", "system"]);
exports.memberRoleEnum = (0, pg_core_1.pgEnum)("member_role", ["owner", "admin", "moderator", "member"]);
exports.reactionTypeEnum = (0, pg_core_1.pgEnum)("reaction_type", ["like", "love", "laugh", "wow", "sad", "angry"]);
exports.eventTypeEnum = (0, pg_core_1.pgEnum)("event_type", ["training", "match", "meeting", "social", "other"]);
exports.eventStatusEnum = (0, pg_core_1.pgEnum)("event_status", ["scheduled", "in_progress", "completed", "cancelled", "postponed"]);
exports.accountTable = (0, pg_core_1.pgTable)("account", {
    id: (0, pg_core_1.serial)("id").primaryKey(),
    email: (0, pg_core_1.varchar)("email", { length: 255 }).notNull(),
    firstName: (0, pg_core_1.varchar)("first_name", { length: 255 }).notNull(),
    lastName: (0, pg_core_1.varchar)("last_name", { length: 255 }).notNull(),
    currency: (0, exports.currencyEnum)("currency").notNull().default("USD"),
    balance: (0, pg_core_1.integer)("balance").notNull().default(0),
}, function (table) { return ({
    emailIdx: (0, pg_core_1.index)("account_email_idx").on(table.email),
}); });
exports.users = (0, pg_core_1.pgTable)("users", {
    id: (0, pg_core_1.uuid)("id").defaultRandom().primaryKey(),
    email: (0, pg_core_1.varchar)("email", { length: 255 }).notNull().unique(),
    username: (0, pg_core_1.varchar)("username", { length: 50 }).notNull().unique(),
    passwordHash: (0, pg_core_1.varchar)("password_hash", { length: 255 }).notNull(),
    firstName: (0, pg_core_1.varchar)("first_name", { length: 100 }),
    lastName: (0, pg_core_1.varchar)("last_name", { length: 100 }),
    fullName: (0, pg_core_1.varchar)("full_name", { length: 200 }),
    displayName: (0, pg_core_1.varchar)("display_name", { length: 100 }),
    bio: (0, pg_core_1.text)("bio"),
    avatarUrl: (0, pg_core_1.text)("avatar_url"),
    phoneNumber: (0, pg_core_1.varchar)("phone_number", { length: 20 }),
    role: (0, pg_core_1.varchar)("role", { length: 50 }).default("player").notNull(),
    status: (0, exports.userStatusEnum)("status").default("offline").notNull(),
    statusMessage: (0, pg_core_1.varchar)("status_message", { length: 255 }),
    lastSeenAt: (0, pg_core_1.timestamp)("last_seen_at", { mode: "date" }),
    isEmailVerified: (0, pg_core_1.boolean)("is_email_verified").default(false).notNull(),
    isPhoneVerified: (0, pg_core_1.boolean)("is_phone_verified").default(false).notNull(),
    isActive: (0, pg_core_1.boolean)("is_active").default(true).notNull(),
    isTwoFactorEnabled: (0, pg_core_1.boolean)("is_two_factor_enabled").default(false).notNull(),
    notificationSettings: (0, pg_core_1.json)("notification_settings")
        .$type()
        .default({ email: true, push: true, sound: true, desktop: true }),
    createdAt: (0, pg_core_1.timestamp)("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at", { mode: "date" }).defaultNow().notNull(),
}, function (table) { return ({
    emailIdx: (0, pg_core_1.uniqueIndex)("users_email_idx").on(table.email),
    usernameIdx: (0, pg_core_1.uniqueIndex)("users_username_idx").on(table.username),
    statusIdx: (0, pg_core_1.index)("users_status_idx").on(table.status),
    createdAtIdx: (0, pg_core_1.index)("users_created_at_idx").on(table.createdAt),
}); });
exports.conversations = (0, pg_core_1.pgTable)("conversations", {
    id: (0, pg_core_1.uuid)("id").defaultRandom().primaryKey(),
    name: (0, pg_core_1.varchar)("name", { length: 255 }),
    description: (0, pg_core_1.text)("description"),
    type: (0, exports.conversationTypeEnum)("type").notNull(),
    avatarUrl: (0, pg_core_1.text)("avatar_url"),
    isArchived: (0, pg_core_1.boolean)("is_archived").default(false).notNull(),
    isPinned: (0, pg_core_1.boolean)("is_pinned").default(false).notNull(),
    lastMessageId: (0, pg_core_1.uuid)("last_message_id"),
    lastMessageAt: (0, pg_core_1.timestamp)("last_message_at", { mode: "date" }),
    metadata: (0, pg_core_1.json)("metadata").$type(),
    createdById: (0, pg_core_1.uuid)("created_by_id")
        .notNull()
        .references(function () { return exports.users.id; }, { onDelete: "cascade" }),
    createdAt: (0, pg_core_1.timestamp)("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at", { mode: "date" }).defaultNow().notNull(),
}, function (table) { return ({
    typeIdx: (0, pg_core_1.index)("conversations_type_idx").on(table.type),
    lastMessageAtIdx: (0, pg_core_1.index)("conversations_last_message_at_idx").on(table.lastMessageAt),
    createdByIdx: (0, pg_core_1.index)("conversations_created_by_idx").on(table.createdById),
    archivedIdx: (0, pg_core_1.index)("conversations_archived_idx").on(table.isArchived),
}); });
exports.conversationMembers = (0, pg_core_1.pgTable)("conversation_members", {
    id: (0, pg_core_1.uuid)("id").defaultRandom().primaryKey(),
    conversationId: (0, pg_core_1.uuid)("conversation_id")
        .notNull()
        .references(function () { return exports.conversations.id; }, { onDelete: "cascade" }),
    userId: (0, pg_core_1.uuid)("user_id")
        .notNull()
        .references(function () { return exports.users.id; }, { onDelete: "cascade" }),
    role: (0, exports.memberRoleEnum)("role").default("member").notNull(),
    nickname: (0, pg_core_1.varchar)("nickname", { length: 100 }),
    isMuted: (0, pg_core_1.boolean)("is_muted").default(false).notNull(),
    mutedUntil: (0, pg_core_1.timestamp)("muted_until", { mode: "date" }),
    isPinned: (0, pg_core_1.boolean)("is_pinned").default(false).notNull(),
    lastReadMessageId: (0, pg_core_1.uuid)("last_read_message_id"),
    lastReadAt: (0, pg_core_1.timestamp)("last_read_at", { mode: "date" }),
    unreadCount: (0, pg_core_1.integer)("unread_count").default(0).notNull(),
    joinedAt: (0, pg_core_1.timestamp)("joined_at", { mode: "date" }).defaultNow().notNull(),
    leftAt: (0, pg_core_1.timestamp)("left_at", { mode: "date" }),
}, function (table) { return ({
    conversationUserUnique: (0, pg_core_1.uniqueIndex)("conversation_members_unique").on(table.conversationId, table.userId),
    conversationIdx: (0, pg_core_1.index)("conversation_members_conversation_idx").on(table.conversationId),
    userIdx: (0, pg_core_1.index)("conversation_members_user_idx").on(table.userId),
    lastReadAtIdx: (0, pg_core_1.index)("conversation_members_last_read_at_idx").on(table.lastReadAt),
}); });
exports.messages = (0, pg_core_1.pgTable)("messages", {
    id: (0, pg_core_1.uuid)("id").defaultRandom().primaryKey(),
    conversationId: (0, pg_core_1.uuid)("conversation_id")
        .notNull()
        .references(function () { return exports.conversations.id; }, { onDelete: "cascade" }),
    senderId: (0, pg_core_1.uuid)("sender_id")
        .notNull()
        .references(function () { return exports.users.id; }, { onDelete: "cascade" }),
    replyToId: (0, pg_core_1.uuid)("reply_to_id"),
    forwardedFromId: (0, pg_core_1.uuid)("forwarded_from_id"),
    type: (0, exports.messageTypeEnum)("type").notNull(),
    content: (0, pg_core_1.text)("content"),
    metadata: (0, pg_core_1.json)("metadata").$type(),
    isEdited: (0, pg_core_1.boolean)("is_edited").default(false).notNull(),
    editedAt: (0, pg_core_1.timestamp)("edited_at", { mode: "date" }),
    isDeleted: (0, pg_core_1.boolean)("is_deleted").default(false).notNull(),
    deletedAt: (0, pg_core_1.timestamp)("deleted_at", { mode: "date" }),
    isPinned: (0, pg_core_1.boolean)("is_pinned").default(false).notNull(),
    pinnedAt: (0, pg_core_1.timestamp)("pinned_at", { mode: "date" }),
    pinnedById: (0, pg_core_1.uuid)("pinned_by_id").references(function () { return exports.users.id; }),
    createdAt: (0, pg_core_1.timestamp)("created_at", { mode: "date" }).defaultNow().notNull(),
}, function (table) { return ({
    conversationIdx: (0, pg_core_1.index)("messages_conversation_idx").on(table.conversationId),
    senderIdx: (0, pg_core_1.index)("messages_sender_idx").on(table.senderId),
    createdAtIdx: (0, pg_core_1.index)("messages_created_at_idx").on(table.createdAt),
    conversationCreatedAtIdx: (0, pg_core_1.index)("messages_conversation_created_at_idx").on(table.conversationId, table.createdAt),
    replyToIdx: (0, pg_core_1.index)("messages_reply_to_idx").on(table.replyToId),
    typeIdx: (0, pg_core_1.index)("messages_type_idx").on(table.type),
    deletedIdx: (0, pg_core_1.index)("messages_deleted_idx").on(table.isDeleted),
}); });
exports.messageReactions = (0, pg_core_1.pgTable)("message_reactions", {
    id: (0, pg_core_1.uuid)("id").defaultRandom().primaryKey(),
    messageId: (0, pg_core_1.uuid)("message_id")
        .notNull()
        .references(function () { return exports.messages.id; }, { onDelete: "cascade" }),
    userId: (0, pg_core_1.uuid)("user_id")
        .notNull()
        .references(function () { return exports.users.id; }, { onDelete: "cascade" }),
    emoji: (0, pg_core_1.varchar)("emoji", { length: 10 }).notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at", { mode: "date" }).defaultNow().notNull(),
}, function (table) { return ({
    messageUserEmojiUnique: (0, pg_core_1.uniqueIndex)("message_reactions_unique").on(table.messageId, table.userId, table.emoji),
    messageIdx: (0, pg_core_1.index)("message_reactions_message_idx").on(table.messageId),
    userIdx: (0, pg_core_1.index)("message_reactions_user_idx").on(table.userId),
}); });
exports.messageReceipts = (0, pg_core_1.pgTable)("message_receipts", {
    id: (0, pg_core_1.uuid)("id").defaultRandom().primaryKey(),
    messageId: (0, pg_core_1.uuid)("message_id")
        .notNull()
        .references(function () { return exports.messages.id; }, { onDelete: "cascade" }),
    userId: (0, pg_core_1.uuid)("user_id")
        .notNull()
        .references(function () { return exports.users.id; }, { onDelete: "cascade" }),
    isDelivered: (0, pg_core_1.boolean)("is_delivered").default(false).notNull(),
    deliveredAt: (0, pg_core_1.timestamp)("delivered_at", { mode: "date" }),
    isRead: (0, pg_core_1.boolean)("is_read").default(false).notNull(),
    readAt: (0, pg_core_1.timestamp)("read_at", { mode: "date" }),
}, function (table) { return ({
    messageUserUnique: (0, pg_core_1.uniqueIndex)("message_receipts_unique").on(table.messageId, table.userId),
    messageIdx: (0, pg_core_1.index)("message_receipts_message_idx").on(table.messageId),
    userIdx: (0, pg_core_1.index)("message_receipts_user_idx").on(table.userId),
    deliveredIdx: (0, pg_core_1.index)("message_receipts_delivered_idx").on(table.isDelivered),
    readIdx: (0, pg_core_1.index)("message_receipts_read_idx").on(table.isRead),
}); });
exports.attachments = (0, pg_core_1.pgTable)("attachments", {
    id: (0, pg_core_1.uuid)("id").defaultRandom().primaryKey(),
    messageId: (0, pg_core_1.uuid)("message_id")
        .notNull()
        .references(function () { return exports.messages.id; }, { onDelete: "cascade" }),
    fileName: (0, pg_core_1.varchar)("file_name", { length: 255 }).notNull(),
    fileSize: (0, pg_core_1.integer)("file_size").notNull(),
    mimeType: (0, pg_core_1.varchar)("mime_type", { length: 100 }).notNull(),
    url: (0, pg_core_1.text)("url").notNull(),
    thumbnailUrl: (0, pg_core_1.text)("thumbnail_url"),
    metadata: (0, pg_core_1.json)("metadata").$type(),
    uploadedAt: (0, pg_core_1.timestamp)("uploaded_at", { mode: "date" }).defaultNow().notNull(),
}, function (table) { return ({
    messageIdx: (0, pg_core_1.index)("attachments_message_idx").on(table.messageId),
    mimeTypeIdx: (0, pg_core_1.index)("attachments_mime_type_idx").on(table.mimeType),
}); });
exports.userContacts = (0, pg_core_1.pgTable)("user_contacts", {
    id: (0, pg_core_1.uuid)("id").defaultRandom().primaryKey(),
    userId: (0, pg_core_1.uuid)("user_id")
        .notNull()
        .references(function () { return exports.users.id; }, { onDelete: "cascade" }),
    contactId: (0, pg_core_1.uuid)("contact_id")
        .notNull()
        .references(function () { return exports.users.id; }, { onDelete: "cascade" }),
    nickname: (0, pg_core_1.varchar)("nickname", { length: 100 }),
    isBlocked: (0, pg_core_1.boolean)("is_blocked").default(false).notNull(),
    isFavorite: (0, pg_core_1.boolean)("is_favorite").default(false).notNull(),
    addedAt: (0, pg_core_1.timestamp)("added_at", { mode: "date" }).defaultNow().notNull(),
}, function (table) { return ({
    userContactUnique: (0, pg_core_1.uniqueIndex)("user_contacts_unique").on(table.userId, table.contactId),
    userIdx: (0, pg_core_1.index)("user_contacts_user_idx").on(table.userId),
    contactIdx: (0, pg_core_1.index)("user_contacts_contact_idx").on(table.contactId),
    blockedIdx: (0, pg_core_1.index)("user_contacts_blocked_idx").on(table.isBlocked),
    favoriteIdx: (0, pg_core_1.index)("user_contacts_favorite_idx").on(table.isFavorite),
}); });
exports.events = (0, pg_core_1.pgTable)("events", {
    id: (0, pg_core_1.uuid)("id").defaultRandom().primaryKey(),
    title: (0, pg_core_1.varchar)("title", { length: 255 }).notNull(),
    description: (0, pg_core_1.text)("description"),
    type: (0, exports.eventTypeEnum)("type").notNull(),
    status: (0, exports.eventStatusEnum)("status").default("scheduled").notNull(),
    location: (0, pg_core_1.varchar)("location", { length: 500 }),
    startTime: (0, pg_core_1.timestamp)("start_time", { mode: "date" }).notNull(),
    endTime: (0, pg_core_1.timestamp)("end_time", { mode: "date" }).notNull(),
    isAllDay: (0, pg_core_1.boolean)("is_all_day").default(false).notNull(),
    createdById: (0, pg_core_1.uuid)("created_by_id")
        .notNull()
        .references(function () { return exports.users.id; }, { onDelete: "cascade" }),
    maxParticipants: (0, pg_core_1.integer)("max_participants"),
    isPublic: (0, pg_core_1.boolean)("is_public").default(true).notNull(),
    requiresRsvp: (0, pg_core_1.boolean)("requires_rsvp").default(false).notNull(),
    metadata: (0, pg_core_1.json)("metadata").$type(),
    createdAt: (0, pg_core_1.timestamp)("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at", { mode: "date" }).defaultNow().notNull(),
}, function (table) { return ({
    createdByIdx: (0, pg_core_1.index)("events_created_by_idx").on(table.createdById),
    startTimeIdx: (0, pg_core_1.index)("events_start_time_idx").on(table.startTime),
    endTimeIdx: (0, pg_core_1.index)("events_end_time_idx").on(table.endTime),
    typeIdx: (0, pg_core_1.index)("events_type_idx").on(table.type),
    statusIdx: (0, pg_core_1.index)("events_status_idx").on(table.status),
    publicIdx: (0, pg_core_1.index)("events_public_idx").on(table.isPublic),
}); });
exports.eventParticipants = (0, pg_core_1.pgTable)("event_participants", {
    id: (0, pg_core_1.uuid)("id").defaultRandom().primaryKey(),
    eventId: (0, pg_core_1.uuid)("event_id")
        .notNull()
        .references(function () { return exports.events.id; }, { onDelete: "cascade" }),
    userId: (0, pg_core_1.uuid)("user_id")
        .notNull()
        .references(function () { return exports.users.id; }, { onDelete: "cascade" }),
    status: (0, pg_core_1.varchar)("status", { length: 50 })
        .notNull()
        .default("invited")
        .$type(),
    role: (0, pg_core_1.varchar)("role", { length: 50 })
        .notNull()
        .default("participant")
        .$type(),
    notes: (0, pg_core_1.text)("notes"),
    responseAt: (0, pg_core_1.timestamp)("response_at", { mode: "date" }),
    checkInAt: (0, pg_core_1.timestamp)("check_in_at", { mode: "date" }),
    createdAt: (0, pg_core_1.timestamp)("created_at", { mode: "date" }).defaultNow().notNull(),
}, function (table) { return ({
    eventUserUnique: (0, pg_core_1.uniqueIndex)("event_participants_unique").on(table.eventId, table.userId),
    eventIdx: (0, pg_core_1.index)("event_participants_event_idx").on(table.eventId),
    userIdx: (0, pg_core_1.index)("event_participants_user_idx").on(table.userId),
    statusIdx: (0, pg_core_1.index)("event_participants_status_idx").on(table.status),
}); });
exports.notifications = (0, pg_core_1.pgTable)("notifications", {
    id: (0, pg_core_1.uuid)("id").defaultRandom().primaryKey(),
    userId: (0, pg_core_1.uuid)("user_id")
        .notNull()
        .references(function () { return exports.users.id; }, { onDelete: "cascade" }),
    type: (0, exports.notificationTypeEnum)("type").notNull(),
    title: (0, pg_core_1.varchar)("title", { length: 255 }).notNull(),
    body: (0, pg_core_1.text)("body"),
    data: (0, pg_core_1.json)("data").$type(),
    isRead: (0, pg_core_1.boolean)("is_read").default(false).notNull(),
    readAt: (0, pg_core_1.timestamp)("read_at", { mode: "date" }),
    createdAt: (0, pg_core_1.timestamp)("created_at", { mode: "date" }).defaultNow().notNull(),
}, function (table) { return ({
    userIdx: (0, pg_core_1.index)("notifications_user_idx").on(table.userId),
    typeIdx: (0, pg_core_1.index)("notifications_type_idx").on(table.type),
    isReadIdx: (0, pg_core_1.index)("notifications_is_read_idx").on(table.isRead),
    createdAtIdx: (0, pg_core_1.index)("notifications_created_at_idx").on(table.createdAt),
    userIsReadIdx: (0, pg_core_1.index)("notifications_user_is_read_idx").on(table.userId, table.isRead),
}); });
exports.userSessions = (0, pg_core_1.pgTable)("user_sessions", {
    id: (0, pg_core_1.uuid)("id").defaultRandom().primaryKey(),
    userId: (0, pg_core_1.uuid)("user_id")
        .notNull()
        .references(function () { return exports.users.id; }, { onDelete: "cascade" }),
    refreshToken: (0, pg_core_1.varchar)("refresh_token", { length: 255 }).notNull().unique(),
    ipAddress: (0, pg_core_1.varchar)("ip_address", { length: 45 }),
    userAgent: (0, pg_core_1.text)("user_agent"),
    deviceInfo: (0, pg_core_1.json)("device_info").$type(),
    isValid: (0, pg_core_1.boolean)("is_valid").default(true).notNull(),
    lastActivityAt: (0, pg_core_1.timestamp)("last_activity_at", { mode: "date" }).defaultNow().notNull(),
    expiresAt: (0, pg_core_1.timestamp)("expires_at", { mode: "date" }).notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at", { mode: "date" }).defaultNow().notNull(),
}, function (table) { return ({
    refreshTokenIdx: (0, pg_core_1.uniqueIndex)("user_sessions_refresh_token_idx").on(table.refreshToken),
    userIdx: (0, pg_core_1.index)("user_sessions_user_idx").on(table.userId),
    expiresAtIdx: (0, pg_core_1.index)("user_sessions_expires_at_idx").on(table.expiresAt),
    isValidIdx: (0, pg_core_1.index)("user_sessions_is_valid_idx").on(table.isValid),
}); });
exports.userPresence = (0, pg_core_1.pgTable)("user_presence", {
    id: (0, pg_core_1.uuid)("id").defaultRandom().primaryKey(),
    userId: (0, pg_core_1.uuid)("user_id")
        .notNull()
        .references(function () { return exports.users.id; }, { onDelete: "cascade" })
        .unique(),
    status: (0, exports.userStatusEnum)("status").notNull(),
    lastActiveAt: (0, pg_core_1.timestamp)("last_active_at", { mode: "date" }).defaultNow().notNull(),
    currentConversationId: (0, pg_core_1.uuid)("current_conversation_id").references(function () { return exports.conversations.id; }, { onDelete: "set null" }),
    isTyping: (0, pg_core_1.boolean)("is_typing").default(false).notNull(),
    typingInConversationId: (0, pg_core_1.uuid)("typing_in_conversation_id").references(function () { return exports.conversations.id; }, {
        onDelete: "set null",
    }),
    updatedAt: (0, pg_core_1.timestamp)("updated_at", { mode: "date" }).defaultNow().notNull(),
}, function (table) { return ({
    userIdx: (0, pg_core_1.uniqueIndex)("user_presence_user_idx").on(table.userId),
    statusIdx: (0, pg_core_1.index)("user_presence_status_idx").on(table.status),
    lastActiveIdx: (0, pg_core_1.index)("user_presence_last_active_idx").on(table.lastActiveAt),
}); });
exports.usersRelations = (0, drizzle_orm_1.relations)(exports.users, function (_a) {
    var many = _a.many, one = _a.one;
    return ({
        conversations: many(exports.conversationMembers),
        messages: many(exports.messages),
        notifications: many(exports.notifications),
        sessions: many(exports.userSessions),
        contacts: many(exports.userContacts, { relationName: "userContacts" }),
        contactOf: many(exports.userContacts, { relationName: "contactOf" }),
        reactions: many(exports.messageReactions),
        receipts: many(exports.messageReceipts),
        presence: one(exports.userPresence),
        createdConversations: many(exports.conversations),
        createdEvents: many(exports.events),
        eventParticipations: many(exports.eventParticipants),
    });
});
exports.conversationsRelations = (0, drizzle_orm_1.relations)(exports.conversations, function (_a) {
    var many = _a.many, one = _a.one;
    return ({
        members: many(exports.conversationMembers),
        messages: many(exports.messages),
        creator: one(exports.users, {
            fields: [exports.conversations.createdById],
            references: [exports.users.id],
        }),
        lastMessage: one(exports.messages, {
            fields: [exports.conversations.lastMessageId],
            references: [exports.messages.id],
        }),
    });
});
exports.conversationMembersRelations = (0, drizzle_orm_1.relations)(exports.conversationMembers, function (_a) {
    var one = _a.one;
    return ({
        conversation: one(exports.conversations, {
            fields: [exports.conversationMembers.conversationId],
            references: [exports.conversations.id],
        }),
        user: one(exports.users, {
            fields: [exports.conversationMembers.userId],
            references: [exports.users.id],
        }),
        lastReadMessage: one(exports.messages, {
            fields: [exports.conversationMembers.lastReadMessageId],
            references: [exports.messages.id],
        }),
    });
});
exports.messagesRelations = (0, drizzle_orm_1.relations)(exports.messages, function (_a) {
    var one = _a.one, many = _a.many;
    return ({
        conversation: one(exports.conversations, {
            fields: [exports.messages.conversationId],
            references: [exports.conversations.id],
        }),
        sender: one(exports.users, {
            fields: [exports.messages.senderId],
            references: [exports.users.id],
        }),
        replyTo: one(exports.messages, {
            fields: [exports.messages.replyToId],
            references: [exports.messages.id],
            relationName: "messageReplies",
        }),
        replies: many(exports.messages, { relationName: "messageReplies" }),
        forwardedFrom: one(exports.messages, {
            fields: [exports.messages.forwardedFromId],
            references: [exports.messages.id],
            relationName: "messageForwards",
        }),
        forwards: many(exports.messages, { relationName: "messageForwards" }),
        reactions: many(exports.messageReactions),
        receipts: many(exports.messageReceipts),
        attachments: many(exports.attachments),
        pinnedBy: one(exports.users, {
            fields: [exports.messages.pinnedById],
            references: [exports.users.id],
        }),
    });
});
exports.messageReactionsRelations = (0, drizzle_orm_1.relations)(exports.messageReactions, function (_a) {
    var one = _a.one;
    return ({
        message: one(exports.messages, {
            fields: [exports.messageReactions.messageId],
            references: [exports.messages.id],
        }),
        user: one(exports.users, {
            fields: [exports.messageReactions.userId],
            references: [exports.users.id],
        }),
    });
});
exports.messageReceiptsRelations = (0, drizzle_orm_1.relations)(exports.messageReceipts, function (_a) {
    var one = _a.one;
    return ({
        message: one(exports.messages, {
            fields: [exports.messageReceipts.messageId],
            references: [exports.messages.id],
        }),
        user: one(exports.users, {
            fields: [exports.messageReceipts.userId],
            references: [exports.users.id],
        }),
    });
});
exports.attachmentsRelations = (0, drizzle_orm_1.relations)(exports.attachments, function (_a) {
    var one = _a.one;
    return ({
        message: one(exports.messages, {
            fields: [exports.attachments.messageId],
            references: [exports.messages.id],
        }),
    });
});
exports.userContactsRelations = (0, drizzle_orm_1.relations)(exports.userContacts, function (_a) {
    var one = _a.one;
    return ({
        user: one(exports.users, {
            fields: [exports.userContacts.userId],
            references: [exports.users.id],
            relationName: "userContacts",
        }),
        contact: one(exports.users, {
            fields: [exports.userContacts.contactId],
            references: [exports.users.id],
            relationName: "contactOf",
        }),
    });
});
exports.notificationsRelations = (0, drizzle_orm_1.relations)(exports.notifications, function (_a) {
    var one = _a.one;
    return ({
        user: one(exports.users, {
            fields: [exports.notifications.userId],
            references: [exports.users.id],
        }),
    });
});
exports.userSessionsRelations = (0, drizzle_orm_1.relations)(exports.userSessions, function (_a) {
    var one = _a.one;
    return ({
        user: one(exports.users, {
            fields: [exports.userSessions.userId],
            references: [exports.users.id],
        }),
    });
});
exports.userPresenceRelations = (0, drizzle_orm_1.relations)(exports.userPresence, function (_a) {
    var one = _a.one;
    return ({
        user: one(exports.users, {
            fields: [exports.userPresence.userId],
            references: [exports.users.id],
        }),
        currentConversation: one(exports.conversations, {
            fields: [exports.userPresence.currentConversationId],
            references: [exports.conversations.id],
            relationName: "currentConversation",
        }),
        typingInConversation: one(exports.conversations, {
            fields: [exports.userPresence.typingInConversationId],
            references: [exports.conversations.id],
            relationName: "typingConversation",
        }),
    });
});
exports.eventsRelations = (0, drizzle_orm_1.relations)(exports.events, function (_a) {
    var one = _a.one, many = _a.many;
    return ({
        creator: one(exports.users, {
            fields: [exports.events.createdById],
            references: [exports.users.id],
        }),
        participants: many(exports.eventParticipants),
    });
});
exports.eventParticipantsRelations = (0, drizzle_orm_1.relations)(exports.eventParticipants, function (_a) {
    var one = _a.one;
    return ({
        event: one(exports.events, {
            fields: [exports.eventParticipants.eventId],
            references: [exports.events.id],
        }),
        user: one(exports.users, {
            fields: [exports.eventParticipants.userId],
            references: [exports.users.id],
        }),
    });
});
