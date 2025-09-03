DO $$ BEGIN
 CREATE TYPE "currency" AS ENUM('USD', 'EUR', 'GBP');
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
ALTER TABLE "users" ADD COLUMN "account_id" integer;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "account_email_idx" ON "account" ("email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_account_idx" ON "users" ("account_id");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "users" ADD CONSTRAINT "users_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "account"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
