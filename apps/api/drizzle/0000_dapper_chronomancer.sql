CREATE TABLE "pokemon" (
	"id" integer PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"types" text[] NOT NULL,
	"sprite_url" text NOT NULL,
	CONSTRAINT "pokemon_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "pokemon_details" (
	"id" integer PRIMARY KEY NOT NULL,
	"data" jsonb NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
