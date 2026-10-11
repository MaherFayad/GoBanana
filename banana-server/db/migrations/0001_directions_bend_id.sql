ALTER TABLE "directions" ADD COLUMN "bend_id" text;--> statement-breakpoint
CREATE UNIQUE INDEX "directions_canvas_bend_idx" ON "directions" USING btree ("canvas_id","bend_id");--> statement-breakpoint
CREATE INDEX "directions_bend_id_idx" ON "directions" USING btree ("bend_id");