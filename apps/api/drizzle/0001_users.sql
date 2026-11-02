CREATE TABLE "user" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"registration" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text NOT NULL,
	"coordinator_id" uuid,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email"),
	CONSTRAINT "user_registration_unique" UNIQUE("registration"),
	CONSTRAINT "user_coordinator_only_for_seller" CHECK (("user"."role" = 'seller') = ("user"."coordinator_id" IS NOT NULL)),
	CONSTRAINT "user_email_lowercase" CHECK ("user"."email" = lower("user"."email"))
);
--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_coordinator_id_user_id_fk" FOREIGN KEY ("coordinator_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;