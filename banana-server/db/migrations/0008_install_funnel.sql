CREATE TABLE "install_funnel" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"first_ping_at" timestamp with time zone,
	"first_canvas_at" timestamp with time zone,
	"first_keep_at" timestamp with time zone,
	"first_export_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "install_funnel" ADD CONSTRAINT "install_funnel_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
