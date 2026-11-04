ALTER TABLE "moves" ADD COLUMN "accuracy" integer;--> statement-breakpoint
ALTER TABLE "moves" ADD COLUMN "ailment" text;--> statement-breakpoint
ALTER TABLE "moves" ADD COLUMN "ailment_chance" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "moves" ADD COLUMN "crit_rate" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "moves" ADD COLUMN "data_version" integer DEFAULT 0 NOT NULL;