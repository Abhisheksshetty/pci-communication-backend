DO $$ BEGIN
 CREATE TYPE "event_status" AS ENUM('scheduled', 'in_progress', 'completed', 'cancelled', 'postponed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "event_type" AS ENUM('training', 'match', 'meeting', 'social', 'other');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "event_participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"status" varchar(50) DEFAULT 'invited' NOT NULL,
	"role" varchar(50) DEFAULT 'participant' NOT NULL,
	"notes" text,
	"response_at" timestamp,
	"check_in_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"type" "event_type" NOT NULL,
	"status" "event_status" DEFAULT 'scheduled' NOT NULL,
	"location" varchar(500),
	"start_time" timestamp NOT NULL,
	"end_time" timestamp NOT NULL,
	"is_all_day" boolean DEFAULT false NOT NULL,
	"created_by_id" uuid NOT NULL,
	"max_participants" integer,
	"is_public" boolean DEFAULT true NOT NULL,
	"requires_rsvp" boolean DEFAULT false NOT NULL,
	"metadata" json,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "full_name" varchar(200);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "role" varchar(50) DEFAULT 'player' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "event_participants_unique" ON "event_participants" ("event_id","user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "event_participants_event_idx" ON "event_participants" ("event_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "event_participants_user_idx" ON "event_participants" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "event_participants_status_idx" ON "event_participants" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "events_created_by_idx" ON "events" ("created_by_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "events_start_time_idx" ON "events" ("start_time");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "events_end_time_idx" ON "events" ("end_time");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "events_type_idx" ON "events" ("type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "events_status_idx" ON "events" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "events_public_idx" ON "events" ("is_public");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "event_participants" ADD CONSTRAINT "event_participants_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "event_participants" ADD CONSTRAINT "event_participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "events" ADD CONSTRAINT "events_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
