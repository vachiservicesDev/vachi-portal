CREATE TABLE IF NOT EXISTS "company_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"legal_name" varchar(200) NOT NULL,
	"address" text,
	"ein" varchar(20),
	"phone" varchar(30),
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "pay_type" varchar(10);--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "pay_rate" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "annual_salary" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "pay_frequency" varchar(20);--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "work_state" varchar(2);--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "w4" jsonb;--> statement-breakpoint
ALTER TABLE "company_settings" ENABLE ROW LEVEL SECURITY;
