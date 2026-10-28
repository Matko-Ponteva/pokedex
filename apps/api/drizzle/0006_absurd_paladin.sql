CREATE INDEX "likes_team_id_idx" ON "likes" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "teams_user_id_idx" ON "teams" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "teams_public_popular_idx" ON "teams" USING btree ("like_count" DESC NULLS LAST,"id" DESC NULLS LAST) WHERE "teams"."is_public" = true;--> statement-breakpoint
CREATE INDEX "teams_public_name_idx" ON "teams" USING btree ("name","id") WHERE "teams"."is_public" = true;