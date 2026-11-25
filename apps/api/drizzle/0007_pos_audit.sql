CREATE TABLE "audit_item" (
	"id" uuid PRIMARY KEY NOT NULL,
	"visit_id" uuid NOT NULL,
	"loan_id" uuid NOT NULL,
	"condition" text NOT NULL,
	"justification" text,
	"occurred_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "audit_item_visit_loan_unique" UNIQUE("visit_id","loan_id"),
	CONSTRAINT "audit_item_missing_justified" CHECK ("audit_item"."condition" <> 'missing' OR "audit_item"."justification" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "loan" (
	"id" uuid PRIMARY KEY NOT NULL,
	"material_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"serial_number" text NOT NULL,
	"installed_at" date NOT NULL,
	"ended_at" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "loan_ended_after_installed" CHECK ("loan"."ended_at" IS NULL OR "loan"."ended_at" >= "loan"."installed_at")
);
--> statement-breakpoint
CREATE TABLE "photo" (
	"id" uuid PRIMARY KEY NOT NULL,
	"visit_id" uuid NOT NULL,
	"audit_item_id" uuid,
	"storage_key" text NOT NULL,
	"taken_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pos_material" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_item" ADD CONSTRAINT "audit_item_visit_id_visit_id_fk" FOREIGN KEY ("visit_id") REFERENCES "public"."visit"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_item" ADD CONSTRAINT "audit_item_loan_id_loan_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."loan"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan" ADD CONSTRAINT "loan_material_id_pos_material_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."pos_material"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan" ADD CONSTRAINT "loan_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photo" ADD CONSTRAINT "photo_visit_id_visit_id_fk" FOREIGN KEY ("visit_id") REFERENCES "public"."visit"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photo" ADD CONSTRAINT "photo_audit_item_id_audit_item_id_fk" FOREIGN KEY ("audit_item_id") REFERENCES "public"."audit_item"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "loan_customer_idx" ON "loan" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "photo_visit_idx" ON "photo" USING btree ("visit_id");--> statement-breakpoint
CREATE INDEX "photo_audit_item_idx" ON "photo" USING btree ("audit_item_id");