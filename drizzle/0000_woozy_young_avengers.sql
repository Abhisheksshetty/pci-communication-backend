DO $$ BEGIN
 CREATE TYPE "conversation_type" AS ENUM('direct', 'group', 'channel');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "currency" AS ENUM('USD', 'EUR', 'GBP');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "member_role" AS ENUM('owner', 'admin', 'moderator', 'member');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "message_type" AS ENUM('text', 'image', 'video', 'audio', 'file', 'system');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "notification_type" AS ENUM('message', 'mention', 'reaction', 'system');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "reaction_type" AS ENUM('like', 'love', 'laugh', 'wow', 'sad', 'angry');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "user_status" AS ENUM('online', 'offline', 'away', 'busy', 'invisible');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "account" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"first_name" varchar(255) NOT NULL,
	"last_name" varchar(255) NOT NULL,
	"currency" "currency" DEFAULT 'USD' NOT NULL,
	"balance" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"file_size" integer NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"url" text NOT NULL,
	"thumbnail_url" text,
	"metadata" json,
	"uploaded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "conversation_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "member_role" DEFAULT 'member' NOT NULL,
	"nickname" varchar(100),
	"is_muted" boolean DEFAULT false NOT NULL,
	"muted_until" timestamp,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"last_read_message_id" uuid,
	"last_read_at" timestamp,
	"unread_count" integer DEFAULT 0 NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL,
	"left_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255),
	"description" text,
	"type" "conversation_type" NOT NULL,
	"avatar_url" text,
	"is_archived" boolean DEFAULT false NOT NULL,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"last_message_id" uuid,
	"last_message_at" timestamp,
	"metadata" json,
	"created_by_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "message_reactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"emoji" varchar(10) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "message_receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"is_delivered" boolean DEFAULT false NOT NULL,
	"delivered_at" timestamp,
	"is_read" boolean DEFAULT false NOT NULL,
	"read_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"sender_id" uuid NOT NULL,
	"reply_to_id" uuid,
	"forwarded_from_id" uuid,
	"type" "message_type" NOT NULL,
	"content" text,
	"metadata" json,
	"is_edited" boolean DEFAULT false NOT NULL,
	"edited_at" timestamp,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"pinned_at" timestamp,
	"pinned_by_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "notification_type" NOT NULL,
	"title" varchar(255) NOT NULL,
	"body" text,
	"data" json,
	"is_read" boolean DEFAULT false NOT NULL,
	"read_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"nickname" varchar(100),
	"is_blocked" boolean DEFAULT false NOT NULL,
	"is_favorite" boolean DEFAULT false NOT NULL,
	"added_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_presence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"status" "user_status" NOT NULL,
	"last_active_at" timestamp DEFAULT now() NOT NULL,
	"current_conversation_id" uuid,
	"is_typing" boolean DEFAULT false NOT NULL,
	"typing_in_conversation_id" uuid,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_presence_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"refresh_token" varchar(255) NOT NULL,
	"ip_address" varchar(45),
	"user_agent" text,
	"device_info" json,
	"is_valid" boolean DEFAULT true NOT NULL,
	"last_activity_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_sessions_refresh_token_unique" UNIQUE("refresh_token")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"username" varchar(50) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"first_name" varchar(100),
	"last_name" varchar(100),
	"display_name" varchar(100),
	"bio" text,
	"avatar_url" text,
	"phone_number" varchar(20),
	"status" "user_status" DEFAULT 'offline' NOT NULL,
	"status_message" varchar(255),
	"last_seen_at" timestamp,
	"is_email_verified" boolean DEFAULT false NOT NULL,
	"is_phone_verified" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_two_factor_enabled" boolean DEFAULT false NOT NULL,
	"notification_settings" json DEFAULT '{"email":true,"push":true,"sound":true,"desktop":true}'::json,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "account_email_idx" ON "account" ("email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "attachments_message_idx" ON "attachments" ("message_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "attachments_mime_type_idx" ON "attachments" ("mime_type");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "conversation_members_unique" ON "conversation_members" ("conversation_id","user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "conversation_members_conversation_idx" ON "conversation_members" ("conversation_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "conversation_members_user_idx" ON "conversation_members" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "conversation_members_last_read_at_idx" ON "conversation_members" ("last_read_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "conversations_type_idx" ON "conversations" ("type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "conversations_last_message_at_idx" ON "conversations" ("last_message_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "conversations_created_by_idx" ON "conversations" ("created_by_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "conversations_archived_idx" ON "conversations" ("is_archived");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "message_reactions_unique" ON "message_reactions" ("message_id","user_id","emoji");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "message_reactions_message_idx" ON "message_reactions" ("message_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "message_reactions_user_idx" ON "message_reactions" ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "message_receipts_unique" ON "message_receipts" ("message_id","user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "message_receipts_message_idx" ON "message_receipts" ("message_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "message_receipts_user_idx" ON "message_receipts" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "message_receipts_delivered_idx" ON "message_receipts" ("is_delivered");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "message_receipts_read_idx" ON "message_receipts" ("is_read");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "messages_conversation_idx" ON "messages" ("conversation_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "messages_sender_idx" ON "messages" ("sender_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "messages_created_at_idx" ON "messages" ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "messages_conversation_created_at_idx" ON "messages" ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "messages_reply_to_idx" ON "messages" ("reply_to_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "messages_type_idx" ON "messages" ("type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "messages_deleted_idx" ON "messages" ("is_deleted");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_user_idx" ON "notifications" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_type_idx" ON "notifications" ("type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_is_read_idx" ON "notifications" ("is_read");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_created_at_idx" ON "notifications" ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_user_is_read_idx" ON "notifications" ("user_id","is_read");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_contacts_unique" ON "user_contacts" ("user_id","contact_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_contacts_user_idx" ON "user_contacts" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_contacts_contact_idx" ON "user_contacts" ("contact_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_contacts_blocked_idx" ON "user_contacts" ("is_blocked");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_contacts_favorite_idx" ON "user_contacts" ("is_favorite");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_presence_user_idx" ON "user_presence" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_presence_status_idx" ON "user_presence" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_presence_last_active_idx" ON "user_presence" ("last_active_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_sessions_refresh_token_idx" ON "user_sessions" ("refresh_token");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_sessions_user_idx" ON "user_sessions" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_sessions_expires_at_idx" ON "user_sessions" ("expires_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_sessions_is_valid_idx" ON "user_sessions" ("is_valid");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_idx" ON "users" ("email");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_username_idx" ON "users" ("username");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_status_idx" ON "users" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_created_at_idx" ON "users" ("created_at");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "attachments" ADD CONSTRAINT "attachments_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "conversation_members" ADD CONSTRAINT "conversation_members_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "conversation_members" ADD CONSTRAINT "conversation_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "conversations" ADD CONSTRAINT "conversations_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "message_reactions" ADD CONSTRAINT "message_reactions_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "message_reactions" ADD CONSTRAINT "message_reactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "message_receipts" ADD CONSTRAINT "message_receipts_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "message_receipts" ADD CONSTRAINT "message_receipts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "messages" ADD CONSTRAINT "messages_pinned_by_id_users_id_fk" FOREIGN KEY ("pinned_by_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_contacts" ADD CONSTRAINT "user_contacts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_contacts" ADD CONSTRAINT "user_contacts_contact_id_users_id_fk" FOREIGN KEY ("contact_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_presence" ADD CONSTRAINT "user_presence_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_presence" ADD CONSTRAINT "user_presence_current_conversation_id_conversations_id_fk" FOREIGN KEY ("current_conversation_id") REFERENCES "conversations"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_presence" ADD CONSTRAINT "user_presence_typing_in_conversation_id_conversations_id_fk" FOREIGN KEY ("typing_in_conversation_id") REFERENCES "conversations"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
