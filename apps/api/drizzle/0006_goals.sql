CREATE TABLE "goal" (
	"id" uuid PRIMARY KEY NOT NULL,
	"seller_id" uuid NOT NULL,
	"month" date NOT NULL,
	"revenue_target_cents" integer,
	"visits_target" integer,
	"new_customers_target" integer,
	"set_by_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "goal_seller_month_unique" UNIQUE("seller_id","month"),
	CONSTRAINT "goal_month_is_first_day" CHECK (extract(day from "goal"."month") = 1),
	CONSTRAINT "goal_targets_not_negative" CHECK (coalesce("goal"."revenue_target_cents", 0) >= 0 AND coalesce("goal"."visits_target", 0) >= 0 AND coalesce("goal"."new_customers_target", 0) >= 0)
);
--> statement-breakpoint
ALTER TABLE "goal" ADD CONSTRAINT "goal_seller_id_user_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal" ADD CONSTRAINT "goal_set_by_id_user_id_fk" FOREIGN KEY ("set_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;