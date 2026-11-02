CREATE TABLE "customer" (
	"id" uuid PRIMARY KEY NOT NULL,
	"legal_name" text NOT NULL,
	"trade_name" text NOT NULL,
	"document" text NOT NULL,
	"phone" text NOT NULL,
	"contact_name" text NOT NULL,
	"zip_code" text NOT NULL,
	"street" text NOT NULL,
	"number" text NOT NULL,
	"complement" text,
	"district" text NOT NULL,
	"city" text NOT NULL,
	"state" text NOT NULL,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"origin" text NOT NULL,
	"status" text NOT NULL,
	"coordinator_id" uuid NOT NULL,
	"created_by_id" uuid NOT NULL,
	"approved_by_id" uuid,
	"approved_at" timestamp with time zone,
	"rejection_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customer_latitude_range" CHECK ("customer"."latitude" BETWEEN -90 AND 90),
	CONSTRAINT "customer_longitude_range" CHECK ("customer"."longitude" BETWEEN -180 AND 180),
	CONSTRAINT "customer_rejection_reason_only_when_rejected" CHECK (("customer"."status" = 'rejected') = ("customer"."rejection_reason" IS NOT NULL)),
	CONSTRAINT "customer_approval_together" CHECK (("customer"."approved_by_id" IS NULL) = ("customer"."approved_at" IS NULL)),
	CONSTRAINT "customer_portfolio_never_pending" CHECK ("customer"."origin" = 'prospect' OR "customer"."status" NOT IN ('pending_approval', 'rejected'))
);
--> statement-breakpoint
CREATE TABLE "route" (
	"id" uuid PRIMARY KEY NOT NULL,
	"seller_id" uuid NOT NULL,
	"date" date NOT NULL,
	"created_by_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "route_seller_date_unique" UNIQUE("seller_id","date")
);
--> statement-breakpoint
CREATE TABLE "visit" (
	"id" uuid PRIMARY KEY NOT NULL,
	"route_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"checked_in_at" timestamp with time zone,
	"check_in_latitude" double precision,
	"check_in_longitude" double precision,
	"check_in_accuracy_meters" double precision,
	"check_in_distance_meters" double precision,
	"check_in_status" text,
	"check_in_justification" text,
	"checked_out_at" timestamp with time zone,
	"outcome" text,
	"outcome_justification" text,
	"summary" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "visit_route_customer_unique" UNIQUE("route_id","customer_id"),
	CONSTRAINT "visit_position_positive" CHECK ("visit"."position" >= 1),
	CONSTRAINT "visit_check_in_complete" CHECK (num_nonnulls("visit"."checked_in_at", "visit"."check_in_latitude", "visit"."check_in_longitude", "visit"."check_in_accuracy_meters", "visit"."check_in_distance_meters", "visit"."check_in_status") IN (0, 6)),
	CONSTRAINT "visit_out_of_radius_justified" CHECK ("visit"."check_in_status" IS DISTINCT FROM 'out_of_radius' OR "visit"."check_in_justification" IS NOT NULL),
	CONSTRAINT "visit_check_out_needs_check_in" CHECK ("visit"."checked_out_at" IS NULL OR "visit"."checked_in_at" IS NOT NULL),
	CONSTRAINT "visit_check_out_with_outcome" CHECK (("visit"."checked_out_at" IS NULL) = ("visit"."outcome" IS NULL)),
	CONSTRAINT "visit_outcome_justified" CHECK ("visit"."outcome" IS NULL OR "visit"."outcome" IN ('sale_made', 'audit_only') OR "visit"."outcome_justification" IS NOT NULL)
);
--> statement-breakpoint
ALTER TABLE "customer" ADD CONSTRAINT "customer_coordinator_id_user_id_fk" FOREIGN KEY ("coordinator_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer" ADD CONSTRAINT "customer_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer" ADD CONSTRAINT "customer_approved_by_id_user_id_fk" FOREIGN KEY ("approved_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route" ADD CONSTRAINT "route_seller_id_user_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route" ADD CONSTRAINT "route_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visit" ADD CONSTRAINT "visit_route_id_route_id_fk" FOREIGN KEY ("route_id") REFERENCES "public"."route"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visit" ADD CONSTRAINT "visit_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "customer_document_unique" ON "customer" USING btree ("document") WHERE "customer"."status" <> 'rejected';--> statement-breakpoint
CREATE INDEX "customer_coordinator_idx" ON "customer" USING btree ("coordinator_id");--> statement-breakpoint
CREATE INDEX "visit_route_position_idx" ON "visit" USING btree ("route_id","position");--> statement-breakpoint
CREATE INDEX "visit_customer_idx" ON "visit" USING btree ("customer_id");