CREATE TABLE "review_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"canvas_id" uuid NOT NULL,
	"direction_key" text NOT NULL,
	"reviewer_key" text NOT NULL,
	"reviewer_name" text,
	"verdict" text,
	"comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "swipe_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"item_key" text NOT NULL,
	"kind" text NOT NULL,
	"role" text,
	"card_id" text,
	"source_site" text NOT NULL,
	"source_url" text NOT NULL,
	"image_url" text NOT NULL,
	"thumb_url" text NOT NULL,
	"title" text,
	"crop" jsonb,
	"note" text,
	"from_canvas_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "review_feedback" ADD CONSTRAINT "review_feedback_canvas_id_canvases_id_fk" FOREIGN KEY ("canvas_id") REFERENCES "public"."canvases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "swipe_items" ADD CONSTRAINT "swipe_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "swipe_items" ADD CONSTRAINT "swipe_items_from_canvas_id_canvases_id_fk" FOREIGN KEY ("from_canvas_id") REFERENCES "public"."canvases"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "review_feedback_reviewer_idx" ON "review_feedback" USING btree ("canvas_id","direction_key","reviewer_key");--> statement-breakpoint
CREATE INDEX "review_feedback_canvas_updated_idx" ON "review_feedback" USING btree ("canvas_id","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "swipe_items_user_item_idx" ON "swipe_items" USING btree ("user_id","item_key");--> statement-breakpoint
CREATE INDEX "swipe_items_user_created_idx" ON "swipe_items" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "swipe_items_user_role_idx" ON "swipe_items" USING btree ("user_id","role");
