ALTER TABLE "moves" ADD COLUMN "stat_changes" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "moves" ADD COLUMN "stat_target" text DEFAULT 'target' NOT NULL;--> statement-breakpoint
ALTER TABLE "moves" ADD COLUMN "stat_chance" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "moves" ADD COLUMN "healing" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "moves" ADD COLUMN "drain" integer DEFAULT 0 NOT NULL;