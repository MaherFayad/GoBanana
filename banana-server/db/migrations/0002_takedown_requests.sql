CREATE TYPE "public"."takedown_request_status" AS ENUM('open', 'accepted', 'rejected');--> statement-breakpoint
CREATE TABLE "takedown_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"url" text NOT NULL,
	"reason" text NOT NULL,
	"name" text NOT NULL,
	"contact_email" text NOT NULL,
	"role" text NOT NULL,
	"details" text NOT NULL,
	"locale" text DEFAULT 'en' NOT NULL,
	"status" "takedown_request_status" DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "takedown_requests_status_created_idx" ON "takedown_requests" USING btree ("status","created_at");