CREATE TYPE "public"."plan" AS ENUM('free', 'pro_monthly', 'pro_yearly', 'founding');--> statement-breakpoint
CREATE TABLE "canvases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"brief" text,
	"wildness" smallint,
	"lens" text,
	"state" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"share_token" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "canvases_share_token_unique" UNIQUE("share_token")
);
--> statement-breakpoint
CREATE TABLE "directions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"canvas_id" uuid NOT NULL,
	"move" text NOT NULL,
	"title" text NOT NULL,
	"search_query" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "palettes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"canvas_id" uuid NOT NULL,
	"colors" jsonb NOT NULL,
	"contrast" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "references" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"canvas_id" uuid NOT NULL,
	"source_site" text NOT NULL,
	"source_url" text NOT NULL,
	"image_url" text NOT NULL,
	"thumb_url" text NOT NULL,
	"title" text,
	"width" integer,
	"height" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "takedowns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"url_or_domain" text NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "takedowns_url_or_domain_unique" UNIQUE("url_or_domain")
);
--> statement-breakpoint
CREATE TABLE "uploads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"r2_key" text NOT NULL,
	"mime" text NOT NULL,
	"bytes" integer NOT NULL,
	CONSTRAINT "uploads_r2_key_unique" UNIQUE("r2_key")
);
--> statement-breakpoint
CREATE TABLE "usage" (
	"user_id" uuid NOT NULL,
	"period" text NOT NULL,
	"searches" integer DEFAULT 0 NOT NULL,
	"canvases" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "usage_user_id_period_pk" PRIMARY KEY("user_id","period")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workos_id" text NOT NULL,
	"email" text,
	"plan" "plan" DEFAULT 'free' NOT NULL,
	"paddle_customer_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_workos_id_unique" UNIQUE("workos_id")
);
--> statement-breakpoint
ALTER TABLE "canvases" ADD CONSTRAINT "canvases_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "directions" ADD CONSTRAINT "directions_canvas_id_canvases_id_fk" FOREIGN KEY ("canvas_id") REFERENCES "public"."canvases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "palettes" ADD CONSTRAINT "palettes_canvas_id_canvases_id_fk" FOREIGN KEY ("canvas_id") REFERENCES "public"."canvases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "references" ADD CONSTRAINT "references_canvas_id_canvases_id_fk" FOREIGN KEY ("canvas_id") REFERENCES "public"."canvases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uploads" ADD CONSTRAINT "uploads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage" ADD CONSTRAINT "usage_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "canvases_user_id_idx" ON "canvases" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "directions_canvas_id_idx" ON "directions" USING btree ("canvas_id");--> statement-breakpoint
CREATE INDEX "palettes_canvas_id_idx" ON "palettes" USING btree ("canvas_id");--> statement-breakpoint
CREATE INDEX "references_canvas_id_idx" ON "references" USING btree ("canvas_id");--> statement-breakpoint
CREATE INDEX "references_created_at_idx" ON "references" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "uploads_user_id_idx" ON "uploads" USING btree ("user_id");