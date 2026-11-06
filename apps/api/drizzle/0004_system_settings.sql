CREATE TABLE "system_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"checkin_radius_meters" integer NOT NULL,
	"score_weight_revenue" integer NOT NULL,
	"score_weight_visits" integer NOT NULL,
	"score_weight_new_customers" integer NOT NULL,
	"updated_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "system_settings_single_row" CHECK ("system_settings"."id" = 1),
	CONSTRAINT "system_settings_radius_positive" CHECK ("system_settings"."checkin_radius_meters" > 0),
	CONSTRAINT "system_settings_weights_not_negative" CHECK ("system_settings"."score_weight_revenue" >= 0 AND "system_settings"."score_weight_visits" >= 0 AND "system_settings"."score_weight_new_customers" >= 0),
	CONSTRAINT "system_settings_weights_sum_100" CHECK ("system_settings"."score_weight_revenue" + "system_settings"."score_weight_visits" + "system_settings"."score_weight_new_customers" = 100)
);
--> statement-breakpoint
ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_updated_by_id_user_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;