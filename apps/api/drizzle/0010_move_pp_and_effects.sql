ALTER TABLE "moves" ADD COLUMN "pp" integer;--> statement-breakpoint
ALTER TABLE "moves" ADD COLUMN "volatile" text;--> statement-breakpoint
ALTER TABLE "moves" ADD COLUMN "flinch_chance" integer DEFAULT 0 NOT NULL;