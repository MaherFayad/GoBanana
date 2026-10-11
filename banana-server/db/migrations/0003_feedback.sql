CREATE TYPE "public"."feedback_verdict" AS ENUM('great', 'bad');--> statement-breakpoint
CREATE TABLE "blocked_items" (
	"user_id" uuid NOT NULL,
	"item_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "blocked_items_user_id_item_key_pk" PRIMARY KEY("user_id","item_key")
);
--> statement-breakpoint
CREATE TABLE "search_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"item_key" text NOT NULL,
	"source_site" text NOT NULL,
	"lane" text,
	"query" text,
	"term_key" text,
	"arm" text,
	"verdict" "feedback_verdict" NOT NULL,
	"reasons" text[] DEFAULT '{}'::text[] NOT NULL,
	"creator" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "references" ADD COLUMN "result_id" text;--> statement-breakpoint
ALTER TABLE "references" ADD COLUMN "lane" text;--> statement-breakpoint
ALTER TABLE "references" ADD COLUMN "query" text;--> statement-breakpoint
ALTER TABLE "references" ADD COLUMN "term_key" text;--> statement-breakpoint
ALTER TABLE "references" ADD COLUMN "arm" text;--> statement-breakpoint
ALTER TABLE "blocked_items" ADD CONSTRAINT "blocked_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_feedback" ADD CONSTRAINT "search_feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "search_feedback_user_created_idx" ON "search_feedback" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "search_feedback_term_arm_idx" ON "search_feedback" USING btree ("term_key","arm");--> statement-breakpoint
CREATE INDEX "search_feedback_created_at_idx" ON "search_feedback" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "references_result_id_idx" ON "references" USING btree ("result_id");