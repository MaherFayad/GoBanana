CREATE TABLE "atlas_weights" (
	"id" text NOT NULL,
	"kind" text NOT NULL,
	"alpha" integer NOT NULL,
	"beta" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "atlas_weights_kind_id_pk" PRIMARY KEY("kind","id")
);
--> statement-breakpoint
CREATE TABLE "user_taste" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"liked_card_ids" text[] DEFAULT '{}'::text[] NOT NULL,
	"style_words" text[] DEFAULT '{}'::text[] NOT NULL,
	"source_urls" text[] DEFAULT '{}'::text[] NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_taste" ADD CONSTRAINT "user_taste_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
