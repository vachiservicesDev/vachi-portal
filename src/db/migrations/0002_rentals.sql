ALTER TYPE "public"."role" ADD VALUE 'tenant';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "rent_charges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lease_id" uuid NOT NULL,
	"period" date NOT NULL,
	"due_date" date NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"paid_amount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"paid_on" date,
	"payment_method" varchar(30),
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rent_charges_lease_period_key" UNIQUE("lease_id","period")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "rental_leases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"tenant_user_id" uuid,
	"tenant_name" varchar(200) NOT NULL,
	"tenant_email" varchar(255) NOT NULL,
	"tenant_phone" varchar(30),
	"start_date" date NOT NULL,
	"end_date" date,
	"monthly_rent" numeric(10, 2) NOT NULL,
	"due_day" integer DEFAULT 1 NOT NULL,
	"grace_days" integer DEFAULT 9 NOT NULL,
	"late_fee" numeric(10, 2),
	"security_deposit" numeric(10, 2),
	"status" varchar(10) DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "rental_properties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" varchar(150) NOT NULL,
	"address" text NOT NULL,
	"city" varchar(100),
	"state" varchar(2) DEFAULT 'CT' NOT NULL,
	"zip" varchar(10),
	"hoa_name" varchar(150),
	"hoa_contact" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "rental_reminders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"kind" varchar(12) NOT NULL,
	"title" varchar(200) NOT NULL,
	"provider" varchar(150),
	"reference" varchar(100),
	"amount" numeric(10, 2),
	"due_date" date NOT NULL,
	"repeat" varchar(10) DEFAULT 'none' NOT NULL,
	"notes" text,
	"done_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "repair_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"reported_by" uuid,
	"title" varchar(200) NOT NULL,
	"description" text,
	"urgency" varchar(10) DEFAULT 'normal' NOT NULL,
	"status" varchar(12) DEFAULT 'open' NOT NULL,
	"appointment_at" timestamp with time zone,
	"vendor_name" varchar(150),
	"vendor_phone" varchar(30),
	"cost" numeric(10, 2),
	"notes" text,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "rent_charges" ADD CONSTRAINT "rent_charges_lease_id_rental_leases_id_fk" FOREIGN KEY ("lease_id") REFERENCES "public"."rental_leases"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "rental_leases" ADD CONSTRAINT "rental_leases_property_id_rental_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."rental_properties"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "rental_leases" ADD CONSTRAINT "rental_leases_tenant_user_id_profiles_id_fk" FOREIGN KEY ("tenant_user_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "rental_properties" ADD CONSTRAINT "rental_properties_owner_id_profiles_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "rental_reminders" ADD CONSTRAINT "rental_reminders_property_id_rental_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."rental_properties"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "repair_requests" ADD CONSTRAINT "repair_requests_property_id_rental_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."rental_properties"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "repair_requests" ADD CONSTRAINT "repair_requests_reported_by_profiles_id_fk" FOREIGN KEY ("reported_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
-- Same as every other app table: the app reads these through Drizzle (bypassing RLS), so RLS
-- with no policies just keeps them closed to the anon/authenticated API keys.
ALTER TABLE "rental_properties" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "rental_leases" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "rent_charges" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "repair_requests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "rental_reminders" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rental_properties_owner_id_idx" ON "rental_properties" ("owner_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rental_leases_property_id_idx" ON "rental_leases" ("property_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rental_leases_tenant_user_id_idx" ON "rental_leases" ("tenant_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "repair_requests_property_id_idx" ON "repair_requests" ("property_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "repair_requests_reported_by_idx" ON "repair_requests" ("reported_by");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rental_reminders_property_id_idx" ON "rental_reminders" ("property_id");
